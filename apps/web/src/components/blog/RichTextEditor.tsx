'use client';

import dynamic from 'next/dynamic';
import { useMemo } from 'react';

// Avoid SSR issues with TinyMCE
// next/dynamic typing + tinymce-react propTypes can mismatch across versions; cast is safe here.
const Editor = dynamic<any>(() => import('@tinymce/tinymce-react').then((m) => m.Editor as any), { ssr: false });

export default function RichTextEditor({
  value,
  onChange,
  slug,
  disabled,
}: {
  value: string;
  onChange: (html: string) => void;
  slug: string;
  disabled?: boolean;
}) {
  const init = useMemo(() => {
    return {
      // Self-host TinyMCE to avoid Tiny Cloud API key requirement
      base_url: '/tinymce',
      suffix: '.min',
      // TinyMCE 8+ requires explicitly declaring the license mode for self-hosted usage
      // to prevent it from trying to load the (paid) license key manager plugin.
      license_key: 'gpl',
      promotion: false,
      height: 340,
      menubar: true,
      branding: false,
      // Defaults per requirement
      font_family_formats:
        'Cambria=cambria,georgia,serif; Arial=arial,helvetica,sans-serif; Andale Mono=andale mono,times; Book Antiqua=book antiqua,palatino; Comic Sans MS=comic sans ms,sans-serif; Courier New=courier new,courier; Georgia=georgia,palatino; Helvetica=helvetica; Impact=impact,chicago; Symbol=symbol; Tahoma=tahoma,arial,helvetica,sans-serif; Terminal=terminal,monaco; Times New Roman=times new roman,times; Trebuchet MS=trebuchet ms,geneva; Verdana=verdana,geneva; Webdings=webdings; Wingdings=wingdings,zapf dingbats',
      font_size_formats: '10px 11px 12px 14px 16px 18px 24px 36px',
      plugins: [
        'advlist',
        'autolink',
        'lists',
        'link',
        'image',
        'charmap',
        'preview',
        'anchor',
        'searchreplace',
        'visualblocks',
        'code',
        'fullscreen',
        'insertdatetime',
        'media',
        'table',
        'help',
        'wordcount',
      ],
      toolbar:
        'undo redo | blocks | fontfamily fontsize | bold italic underline | alignleft aligncenter alignright | bullist numlist outdent indent | link image | removeformat | code fullscreen',
      content_style: `
        body { font-family: Cambria, Georgia, serif; font-size: 12px; }
        h1,h2,h3 { font-family: Cambria, Georgia, serif; }
      `,
      image_caption: true,
      image_advtab: true,
      automatic_uploads: true,
      images_upload_handler: async (blobInfo: any) => {
        const fd = new FormData();
        fd.append('file', blobInfo.blob(), blobInfo.filename());
        fd.append('slug', slug);
        const res = await fetch('/api/blogs/upload-image', { method: 'POST', body: fd });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || 'Image upload failed');
        const url = String(data?.url || '');
        if (!url) throw new Error('Upload succeeded but no URL returned');
        return url;
      },
      // Ensure users have an alt text field available in image dialog
      image_description: true,
    } as any;
  }, [slug]);

  return (
    <Editor
      tinymceScriptSrc="/tinymce/tinymce.min.js"
      value={value}
      onEditorChange={(html: string) => onChange(String(html || ''))}
      init={init}
      disabled={Boolean(disabled)}
    />
  );
}


