import type { JSX } from 'react';
import { useEffect, useState } from 'react';
import { Mic } from 'lucide-react';
import type { AppInfoResponse } from '@/gen/app_info';
import { ipc } from '@/gen/ipc';

/**
 * About window: displays the application logo, name, version, author, and
 * the "Powered by MōBrowser" attribution.
 */
export function AboutApp(): JSX.Element {
  const [info, setInfo] = useState<AppInfoResponse | null>(null);

  useEffect(() => {
    ipc.appInfo.GetAppInfo({})
      .then(setInfo)
      .catch((err: unknown) => { console.error('[AboutApp] GetAppInfo error:', err); });
  }, []);

  return (
    <div className="flex flex-col items-center justify-center h-full gap-5 bg-background show-animation px-8 text-center">
      {/* Logo */}
      <div className="w-20 h-20 rounded-2xl bg-primary flex items-center justify-center shadow-lg">
        <Mic className="w-10 h-10 text-primary-foreground" />
      </div>

      {/* Name + version */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          {info !== null ? info.name : 'moVoice'}
        </h1>
        {info !== null && info.version !== '' && (
          <p className="text-sm text-muted-foreground mt-1">Version {info.version}</p>
        )}
      </div>

      {/* Author */}
      {info !== null && info.author !== '' && (
        <p className="text-sm text-foreground">{info.author}</p>
      )}

      {/* Attribution */}
      <p className="text-xs text-muted-foreground mt-2">Powered by MōBrowser</p>
    </div>
  );
}
