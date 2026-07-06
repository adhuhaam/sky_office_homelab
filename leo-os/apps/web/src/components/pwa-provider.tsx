import { useEffect, useRef, useState } from "react";
import { Download, RefreshCw } from "lucide-react";
import { registerSW } from "virtual:pwa-register";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isStandaloneDisplay(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function PwaProvider({ children }: { children: React.ReactNode }) {
  const { toast } = useToast();
  const toastRef = useRef(toast);
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const installPrompted = useRef(false);

  useEffect(() => {
    toastRef.current = toast;

    const updateSW = registerSW({
      immediate: true,
      onNeedRefresh() {
        toastRef.current({
          title: "Update available",
          description: "A new version is ready. Reload to apply.",
          duration: 20000,
          action: (
            <Button size="sm" className="gap-1.5" onClick={() => void updateSW(true)}>
              <RefreshCw className="h-3.5 w-3.5" />
              Reload
            </Button>
          ),
        });
      },
      onOfflineReady() {
        toastRef.current({
          title: "Ready for offline",
          description: "The app shell can load without a network connection.",
          duration: 6000,
        });
      },
    });
  }, [toast]);

  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  useEffect(() => {
    if (!installEvent || installPrompted.current || isStandaloneDisplay()) return;
    installPrompted.current = true;
    toast({
      title: "Install LEO OS",
      description: "Add to your home screen for a full-screen app experience.",
      duration: 15000,
      action: (
        <Button
          size="sm"
          className="gap-1.5"
          onClick={async () => {
            await installEvent.prompt();
            setInstallEvent(null);
          }}
        >
          <Download className="h-3.5 w-3.5" />
          Install
        </Button>
      ),
    });
  }, [installEvent, toast]);

  return <>{children}</>;
}

export function PwaInstallButton({ className }: { className?: string }) {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  if (!installEvent || isStandaloneDisplay()) return null;

  return (
    <Button
      variant="outline"
      size="sm"
      className={className}
      onClick={async () => {
        await installEvent.prompt();
        setInstallEvent(null);
      }}
    >
      <Download className="h-4 w-4 mr-1.5" />
      Install app
    </Button>
  );
}
