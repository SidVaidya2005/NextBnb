import type { FormHTMLAttributes } from 'react';
import type { Listing } from '../../types/Listing';
import { Input } from '../common/Input';
import { Button } from '../common/Button';

interface Props extends FormHTMLAttributes<HTMLFormElement> {
  initial?: Partial<Listing>;
  submitLabel?: string;
}

export function ListingForm({
  initial = {},
  submitLabel = 'Save listing',
  onSubmit,
  ...rest
}: Props) {
  return (
    <form className="flex flex-col gap-lg" onSubmit={onSubmit} {...rest}>
      <Input id="title" name="title" label="Title" defaultValue={initial.title ?? ''} required />
      <div className="flex flex-col gap-xs">
        <label htmlFor="description" className="t-caption text-ink-muted">
          Description
        </label>
        <textarea
          id="description"
          name="description"
          rows={4}
          defaultValue={initial.description ?? ''}
          className="bg-surface-canvas border border-hairline rounded-sm px-md py-md t-body-md text-ink placeholder:text-ink-muted-soft focus:outline-none focus:border-ink focus:border-2 focus:px-[11px] focus:py-[11px]"
        />
      </div>
      <Input id="image" name="image" label="Image URL" defaultValue={initial.image ?? ''} />
      <div className="grid grid-cols-1 gap-lg sm:grid-cols-2">
        <Input
          id="price"
          name="price"
          label="Price per night"
          type="number"
          defaultValue={initial.price ?? ''}
          required
        />
        <Input
          id="location"
          name="location"
          label="Location"
          defaultValue={initial.location ?? ''}
        />
      </div>
      <Input id="country" name="country" label="Country" defaultValue={initial.country ?? ''} />
      <div className="flex justify-end">
        <Button type="submit">{submitLabel}</Button>
      </div>
    </form>
  );
}
