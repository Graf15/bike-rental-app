import { useState } from "react";

export const useConfirm = () => {
  const [dialog, setDialog] = useState(null);

  const confirm = (options) => {
    setDialog(options);
  };

  const props = dialog ? {
    ...dialog,
    onConfirm: () => { dialog.onConfirm?.(); setDialog(null); },
    onCancel:  () => { dialog.onCancel?.();  setDialog(null); },
  } : null;

  return [props, confirm];
};
