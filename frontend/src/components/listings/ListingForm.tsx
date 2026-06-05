import { useState } from "react";
import type { ChangeEvent, FormHTMLAttributes } from "react";
import type { Listing, NewListing } from "../../types/Listing";
import { uploadImage } from "../../api/uploads";
import { Input } from "../common/Input";
import { Button } from "../common/Button";

interface Props extends FormHTMLAttributes<HTMLFormElement> {
  initial?: Partial<Listing>;
  submitLabel?: string;
}

/* Only echo a preview for absolute http(s) image URLs. Anything else (a
 * `javascript:`/`data:` scheme, a relative fragment) resolves to "" and renders
 * no <img>, so user-typed text can't be reflected into the DOM as a live URL. */
function safeImageSrc(value: string): string {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.href
      : "";
  } catch {
    return "";
  }
}

/* Reads the uncontrolled form fields into a NewListing payload. `owner` is set
 * server-side from the JWT, so it is intentionally not collected here. */
// eslint-disable-next-line react-refresh/only-export-components
export function readListingForm(form: HTMLFormElement): NewListing {
  const fd = new FormData(form);
  const str = (k: string) => String(fd.get(k) ?? "").trim();
  return {
    title: str("title"),
    description: str("description"),
    image: str("image"),
    price: Number(fd.get("price") ?? 0),
    location: str("location"),
    country: str("country"),
  };
}

export function ListingForm({
  initial = {},
  submitLabel = "Save listing",
  onSubmit,
  ...rest
}: Props) {
  // The image field is controlled so the file picker and manual URL entry write
  // to the same value; FormData still reads it on submit (see readListingForm).
  const [image, setImage] = useState(initial.image ?? "");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const { url } = await uploadImage(file);
      setImage(url);
    } catch {
      setUploadError("Upload failed. Try another image or paste a URL below.");
    } finally {
      setUploading(false);
      e.target.value = ""; // allow re-selecting the same file
    }
  }

  return (
    <form className="flex flex-col gap-lg" onSubmit={onSubmit} {...rest}>
      <Input
        id="title"
        name="title"
        label="Title"
        defaultValue={initial.title ?? ""}
        required
      />
      <div className="flex flex-col gap-xs">
        <label htmlFor="description" className="t-caption text-ink-muted">
          Description
        </label>
        <textarea
          id="description"
          name="description"
          rows={4}
          defaultValue={initial.description ?? ""}
          className="bg-surface-canvas border border-hairline rounded-sm px-md py-md t-body-md text-ink placeholder:text-ink-muted-soft focus:outline-none focus:border-ink focus:border-2 focus:px-[11px] focus:py-[11px]"
        />
      </div>

      <div className="flex flex-col gap-xs">
        <label htmlFor="imageFile" className="t-caption text-ink-muted">
          Photo
        </label>
        {safeImageSrc(image) && (
          <img
            src={safeImageSrc(image)}
            alt="Listing preview"
            className="mb-xs h-40 w-full rounded-sm object-cover"
          />
        )}
        <input
          id="imageFile"
          type="file"
          accept="image/*"
          onChange={handleFile}
          disabled={uploading}
          className="t-body-sm text-ink-muted file:mr-md file:rounded-full file:border-0 file:bg-surface-soft file:px-md file:py-1.5 file:t-caption file:text-ink hover:file:bg-hairline"
        />
        {uploading && <p className="t-caption text-ink-muted">Uploading…</p>}
        {uploadError && <p className="t-caption text-rausch">{uploadError}</p>}
      </div>
      <Input
        id="image"
        name="image"
        label="Image URL"
        placeholder="Upload above, or paste an image URL"
        value={image}
        onChange={(e) => setImage(e.target.value)}
      />

      <div className="grid grid-cols-1 gap-lg sm:grid-cols-2">
        <Input
          id="price"
          name="price"
          label="Price per night"
          type="number"
          defaultValue={initial.price ?? ""}
          required
        />
        <Input
          id="location"
          name="location"
          label="Location"
          defaultValue={initial.location ?? ""}
        />
      </div>
      <Input
        id="country"
        name="country"
        label="Country"
        defaultValue={initial.country ?? ""}
      />
      <div className="flex justify-end">
        <Button type="submit" disabled={uploading}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
