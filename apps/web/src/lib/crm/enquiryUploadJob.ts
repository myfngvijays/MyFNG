export type EnquiryUploadJob = {
  id: string;
  status: 'collecting' | 'running' | 'done' | 'error';
  total: number;
  done: number;
  inserted: number;
  updated: number;
  received: number;
  error: string;
  overwrite: boolean;
  rows: Record<string, unknown>[];
};

const globalStore = globalThis as typeof globalThis & {
  __myfngEnquiryUpload?: EnquiryUploadJob | null;
};

export function readEnquiryUploadJob(): EnquiryUploadJob | null {
  return globalStore.__myfngEnquiryUpload || null;
}

export function writeEnquiryUploadJob(job: EnquiryUploadJob) {
  globalStore.__myfngEnquiryUpload = job;
}

export function patchEnquiryUploadJob(patch: Partial<EnquiryUploadJob>) {
  const current = readEnquiryUploadJob();
  if (!current) return;
  globalStore.__myfngEnquiryUpload = { ...current, ...patch };
}
