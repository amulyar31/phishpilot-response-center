import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Mail, Link2, ImageUp, ShieldAlert, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/pp/client";
import { PageHeader, Panel, ErrorBox } from "@/components/pp/bits";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/submit")({
  head: () => ({
    meta: [
      { title: "Report an incident — PhishPilot" },
      { name: "description", content: "Submit a suspicious email, URL or screenshot for multi-agent investigation." },
      { property: "og:title", content: "Report an incident — PhishPilot" },
      { property: "og:description", content: "Submit a suspicious email, URL or screenshot for multi-agent investigation." },
    ],
  }),
  component: Submit,
});

const MAX = 5 * 1024 * 1024;

function Submit() {
  const [tab, setTab] = useState("email");
  const [email, setEmail] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileErr, setFileErr] = useState<string | null>(null);
  const [created, setCreated] = useState<{ id: string; ref: string } | null>(null);
  const qc = useQueryClient();
  const nav = useNavigate();

  const m = useMutation({
    mutationFn: async () => {
      let body: Record<string, unknown>;
      if (tab === "email") body = { source_type: "email", content: email };
      else if (tab === "url") body = { source_type: "url", content: url };
      else {
        if (!file) throw new Error("Choose an image first");
        const b64 = await new Promise<string>((res, rej) => {
          const r = new FileReader();
          r.onload = () => res(String(r.result).split(",")[1] ?? "");
          r.onerror = () => rej(new Error("Could not read file"));
          r.readAsDataURL(file);
        });
        body = { source_type: "screenshot", image_base64: b64, mime: file.type };
      }
      const inc = await api<{ id: string; ref: string }>("/api/incidents", { method: "POST", json: body });
      // Kick off the orchestrator; the detail page polls progress.
      void api(`/api/incidents/${inc.id}/analyze`, { method: "POST", json: {} }).catch(() => {}).finally(() => qc.invalidateQueries());
      return inc;
    },
    onSuccess: (inc) => {
      setCreated(inc);
      qc.invalidateQueries();
      toast.success(`Incident ${inc.ref} created — investigation started`);
    },
  });

  const onFile = (f: File | null) => {
    setFileErr(null);
    setFile(null);
    if (!f) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(f.type)) return setFileErr("Only PNG, JPEG or WEBP images are allowed.");
    if (f.size > MAX) return setFileErr("Image must be 5MB or smaller.");
    setFile(f);
  };

  if (created)
    return (
      <div className="mx-auto max-w-lg">
        <Panel>
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <CheckCircle2 className="size-10 text-risk-low" />
            <h1 className="text-lg font-semibold">Incident submitted</h1>
            <p className="text-sm text-muted-foreground">Saved to the database. The orchestrator has started the four agents.</p>
            <div className="rounded-md border bg-muted px-4 py-2 font-mono text-lg font-semibold">{created.ref}</div>
            <div className="flex gap-2 pt-2">
              <Button variant="brand" onClick={() => nav({ to: "/incidents/$id", params: { id: created.id } })}>Track investigation</Button>
              <Button variant="outline" onClick={() => { setCreated(null); setEmail(""); setUrl(""); setFile(null); }}>Report another</Button>
            </div>
          </div>
        </Panel>
      </div>
    );

  return (
    <>
      <PageHeader title="Report a suspicious message" subtitle="Each submission gets a unique incident ID and is investigated by four specialist agents." />
      <div className="grid gap-5 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="mb-4 grid w-full grid-cols-3">
              <TabsTrigger value="email"><Mail className="mr-1.5 size-4" />Email</TabsTrigger>
              <TabsTrigger value="url"><Link2 className="mr-1.5 size-4" />URL</TabsTrigger>
              <TabsTrigger value="screenshot"><ImageUp className="mr-1.5 size-4" />Screenshot</TabsTrigger>
            </TabsList>
            <TabsContent value="email" className="space-y-2">
              <Label htmlFor="email">Paste the full email, including From and Subject lines</Label>
              <Textarea id="email" rows={12} className="font-mono text-xs" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={20000}
                placeholder={"From: Sender <sender@example.com>\nSubject: ...\n\nBody text..."} />
              <p className="text-[11px] text-muted-foreground">{email.length}/20000 characters · minimum 20</p>
            </TabsContent>
            <TabsContent value="url" className="space-y-2">
              <Label htmlFor="url">Suspicious URL</Label>
              <Input id="url" className="font-mono text-sm" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="http://example-login.com/verify" maxLength={2000} />
              <p className="text-[11px] text-muted-foreground">The URL is never opened. Only its structure and reputation fixtures are checked.</p>
            </TabsContent>
            <TabsContent value="screenshot" className="space-y-2">
              <Label htmlFor="shot">Email screenshot (PNG, JPEG, WEBP · max 5MB)</Label>
              <Input id="shot" type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
              {fileErr && <p className="text-xs text-risk-high">{fileErr}</p>}
              {file && <p className="text-xs text-muted-foreground">{file.name} · {(file.size / 1024).toFixed(0)} KB</p>}
              <p className="text-[11px] text-muted-foreground">Text is transcribed by an AI vision model; the image itself is not stored.</p>
            </TabsContent>
          </Tabs>
          {m.error && <div className="mt-4"><ErrorBox error={m.error} /></div>}
          <div className="mt-4 flex justify-end">
            <Button variant="brand" disabled={m.isPending} onClick={() => m.mutate()}>{m.isPending ? "Submitting…" : "Submit for investigation"}</Button>
          </div>
        </Panel>
        <Panel title={<span className="flex items-center gap-2"><ShieldAlert className="size-4 text-brand" />Safe reporting</span>}>
          <ul className="space-y-2.5 text-sm text-muted-foreground">
            <li>Do not click links or open attachments in the suspicious message.</li>
            <li>Remove passwords or personal data before pasting.</li>
            <li>Content is treated as untrusted evidence — instructions inside it are ignored.</li>
            <li>No action is executed automatically. All responses need analyst approval.</li>
            <li>Want to try it? Use the <Link to="/settings" className="text-accent-foreground underline">demo samples</Link>.</li>
          </ul>
        </Panel>
      </div>
    </>
  );
}
