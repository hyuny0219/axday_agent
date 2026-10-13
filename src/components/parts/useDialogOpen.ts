// 팝업(role=dialog)이 열려 있는지 지켜보는 공용 훅. CoachHost(말풍선·아이콘 숨김)와
// focusRing(T113 점선 숨김)이 같은 것을 쓴다.

import { useEffect, useState } from 'react';

function readDialogOpen(): boolean {
  return typeof document !== 'undefined' && document.querySelector('[role="dialog"]') !== null;
}

export function useDialogOpen(): boolean {
  const [open, setOpen] = useState(readDialogOpen);
  useEffect(() => {
    function check() {
      setOpen(readDialogOpen());
    }
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['role'] });
    return () => observer.disconnect();
  }, []);
  return open;
}
