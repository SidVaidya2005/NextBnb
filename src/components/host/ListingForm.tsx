'use client'

import type { ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import { AMENITY_META } from '@/components/listings/AmenityList'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { Select } from '@/components/ui/Select'
import { TextInput } from '@/components/ui/TextInput'
import { Textarea } from '@/components/ui/Textarea'
import { createListing, updateListing } from '@/lib/actions/listings'
import { AMENITIES, MAX_GUESTS, PROPERTY_TYPES } from '@/lib/constants'
import { humanizeToken } from '@/lib/utils'
import {
  createListingSchema,
  DEFAULT_CHECK_IN_TIME,
  DEFAULT_CHECK_OUT_TIME,
} from '@/lib/validations/listings'
import type { CreateListingInput, ListingFormValues } from '@/lib/validations/listings'

/** Hourly options for the two time fields — `check_in_time` is `HH:MM` text. */
const HOURS = Array.from({ length: 24 }, (_, hour) => {
  const value = `${String(hour).padStart(2, '0')}:00`
  const hour12 = hour % 12 === 0 ? 12 : hour % 12
  return { value, label: `${hour12}:00 ${hour < 12 ? 'AM' : 'PM'}` }
})

const DEFAULTS: ListingFormValues = {
  title: '',
  description: '',
  propertyType: 'apartment',
  city: '',
  state: '',
  country: '',
  neighborhood: '',
  maxGuests: 2,
  bedrooms: 1,
  beds: 1,
  bathrooms: 1,
  pricePerNight: 100,
  cleaningFee: 0,
  amenities: [],
  houseRules: '',
  checkInTime: DEFAULT_CHECK_IN_TIME,
  checkOutTime: DEFAULT_CHECK_OUT_TIME,
  minNights: 1,
}

/**
 * A discriminated union rather than optional props: `listingId` and the loaded
 * values are meaningless in create mode and mandatory in edit mode, and the
 * union is what makes forgetting one a type error instead of a runtime one.
 */
type Props =
  | { mode: 'create' }
  | { mode: 'edit'; listingId: string; defaultValues: ListingFormValues }

const COPY = {
  create: {
    label: 'List your place',
    submit: 'Save and add photos',
    submitting: 'Saving…',
    note: 'This saves your place as a draft. Nobody can see it until you add a photo and publish.',
  },
  edit: {
    label: 'Edit your listing',
    submit: 'Save changes',
    submitting: 'Saving…',
    note: 'Changes go live straight away if this listing is published.',
  },
} as const

/**
 * The listing fields, for both creating and editing.
 *
 * Creating submits a **draft** and moves to the photo step. It is not a "save as
 * draft vs publish" choice — publishing requires at least one photo, and a photo
 * cannot be uploaded until the listing exists, because `/api/sign-cloudinary`
 * only signs for a listing the caller already owns. Editing saves in place and
 * returns to the host's listings.
 *
 * Both modes resolve with `createListingSchema`, which is the *same* schema each
 * action re-validates with on the server (`updateListingSchema` extends it with
 * the id), so client and server can never disagree about what is acceptable —
 * and so a rule added to creation is enforced on edit for free.
 */
export function ListingForm(props: Props) {
  const router = useRouter()
  const copy = COPY[props.mode]

  const form = useForm<ListingFormValues, unknown, CreateListingInput>({
    resolver: zodResolver(createListingSchema),
    // In edit mode these come from `toListingFormValues`, which is where the
    // nullable columns become the empty strings an <input> can actually hold.
    defaultValues: props.mode === 'edit' ? props.defaultValues : DEFAULTS,
  })

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = form

  async function onSubmit(values: CreateListingInput) {
    if (props.mode === 'edit') {
      const result = await updateListing({ ...values, listingId: props.listingId })

      if (!result.ok) {
        setError('root', { message: result.error })
        return
      }

      // The action already revalidated the affected routes, so this navigates
      // to a fresh render rather than needing a refresh of its own.
      router.push('/host/listings')
      return
    }

    const result = await createListing(values)

    if (!result.ok) {
      setError('root', { message: result.error })
      return
    }

    // Not router.refresh() then push: the photo step is a different route and
    // the draft is brand new, so there is nothing cached to invalidate.
    router.push(`/host/listings/${result.data.id}/photos`)
  }

  const rootError = errors.root?.message

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      // Named so it is addressable: the nav's SearchBar also has a "Guests"
      // control, so an unscoped label lookup matches two elements. The two modes
      // get distinct names so a spec can be certain which form it has hold of.
      aria-label={copy.label}
      className="space-y-12"
    >
      <Section title="About your place">
        <Field label="Title" htmlFor="title" error={errors.title?.message}>
          <TextInput
            id="title"
            placeholder="Cliffside cabin with ocean views"
            invalid={Boolean(errors.title)}
            aria-describedby={errors.title ? 'title-error' : undefined}
            {...register('title')}
          />
        </Field>

        <Field
          label="Description"
          htmlFor="description"
          hint="Optional. What makes the place worth staying in?"
          error={errors.description?.message}
        >
          <Textarea
            id="description"
            rows={5}
            invalid={Boolean(errors.description)}
            {...register('description')}
          />
        </Field>

        <Field
          label="Property type"
          htmlFor="propertyType"
          error={errors.propertyType?.message}
        >
          <Select
            id="propertyType"
            invalid={Boolean(errors.propertyType)}
            {...register('propertyType')}
          >
            {PROPERTY_TYPES.map((type) => (
              <option key={type} value={type}>
                {humanizeToken(type)}
              </option>
            ))}
          </Select>
        </Field>
      </Section>

      <Section title="Where it is">
        <div className="grid gap-6 tablet:grid-cols-2">
          <Field label="City" htmlFor="city" error={errors.city?.message}>
            <TextInput
              id="city"
              autoComplete="address-level2"
              invalid={Boolean(errors.city)}
              {...register('city')}
            />
          </Field>

          <Field label="Country" htmlFor="country" error={errors.country?.message}>
            <TextInput
              id="country"
              autoComplete="country-name"
              invalid={Boolean(errors.country)}
              {...register('country')}
            />
          </Field>

          <Field
            label="State or region"
            htmlFor="state"
            hint="Optional."
            error={errors.state?.message}
          >
            <TextInput id="state" invalid={Boolean(errors.state)} {...register('state')} />
          </Field>

          <Field
            label="Neighbourhood"
            htmlFor="neighborhood"
            hint="Optional."
            error={errors.neighborhood?.message}
          >
            <TextInput
              id="neighborhood"
              invalid={Boolean(errors.neighborhood)}
              {...register('neighborhood')}
            />
          </Field>
        </div>
      </Section>

      <Section title="How many can stay">
        <div className="grid gap-6 tablet:grid-cols-2 desktop:grid-cols-4">
          <NumberField
            id="maxGuests"
            label="Guests"
            max={MAX_GUESTS}
            min={1}
            error={errors.maxGuests?.message}
            register={register('maxGuests', { valueAsNumber: true })}
          />
          <NumberField
            id="bedrooms"
            label="Bedrooms"
            min={0}
            error={errors.bedrooms?.message}
            hint="0 for a studio"
            register={register('bedrooms', { valueAsNumber: true })}
          />
          <NumberField
            id="beds"
            label="Beds"
            min={1}
            error={errors.beds?.message}
            register={register('beds', { valueAsNumber: true })}
          />
          <NumberField
            id="bathrooms"
            label="Bathrooms"
            min={0}
            step={0.5}
            error={errors.bathrooms?.message}
            hint="Halves allowed"
            register={register('bathrooms', { valueAsNumber: true })}
          />
        </div>
      </Section>

      <Section title="Pricing and stays">
        <div className="grid gap-6 tablet:grid-cols-3">
          <NumberField
            id="pricePerNight"
            label="Price per night (USD)"
            min={1}
            step={1}
            error={errors.pricePerNight?.message}
            register={register('pricePerNight', { valueAsNumber: true })}
          />
          <NumberField
            id="cleaningFee"
            label="Cleaning fee (USD)"
            min={0}
            step={1}
            error={errors.cleaningFee?.message}
            hint="0 for none"
            register={register('cleaningFee', { valueAsNumber: true })}
          />
          <NumberField
            id="minNights"
            label="Minimum nights"
            min={1}
            error={errors.minNights?.message}
            register={register('minNights', { valueAsNumber: true })}
          />
        </div>
      </Section>

      <Section title="What you offer">
        <fieldset>
          <legend className="sr-only">Amenities</legend>
          <div className="grid gap-x-6 gap-y-1 tablet:grid-cols-2 desktop:grid-cols-3">
            {AMENITIES.map((amenity) => {
              const { icon: Icon, label } = AMENITY_META[amenity]
              return (
                <label
                  key={amenity}
                  // py-3 lands the row on the 44px tap floor, matching the fix
                  // the Phase 1 close-out made to the account menu.
                  className="flex cursor-pointer items-center gap-3 py-3 text-base text-ink"
                >
                  <input
                    type="checkbox"
                    value={amenity}
                    className="size-5 shrink-0 accent-primary"
                    {...register('amenities')}
                  />
                  <Icon className="size-5 shrink-0 text-muted" aria-hidden />
                  <span>{label}</span>
                </label>
              )
            })}
          </div>
        </fieldset>
        {errors.amenities && (
          <p className="mt-1.5 text-sm text-error">{errors.amenities.message}</p>
        )}
      </Section>

      <Section title="Things to know">
        <div className="grid gap-6 tablet:grid-cols-2">
          <Field
            label="Check-in time"
            htmlFor="checkInTime"
            error={errors.checkInTime?.message}
          >
            <Select id="checkInTime" {...register('checkInTime')}>
              {HOURS.map((hour) => (
                <option key={hour.value} value={hour.value}>
                  {hour.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Check-out time"
            htmlFor="checkOutTime"
            error={errors.checkOutTime?.message}
          >
            <Select id="checkOutTime" {...register('checkOutTime')}>
              {HOURS.map((hour) => (
                <option key={hour.value} value={hour.value}>
                  {hour.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field
          label="House rules"
          htmlFor="houseRules"
          hint="Optional. Quiet hours, pets, anything guests should know."
          error={errors.houseRules?.message}
        >
          <Textarea
            id="houseRules"
            rows={4}
            invalid={Boolean(errors.houseRules)}
            {...register('houseRules')}
          />
        </Field>
      </Section>

      <div className="border-t border-hairline pt-6">
        {rootError && (
          <p role="alert" className="mb-4 text-sm text-error">
            {rootError}
          </p>
        )}

        <Button type="submit" disabled={isSubmitting} className="w-full tablet:w-auto">
          {isSubmitting ? copy.submitting : copy.submit}
        </Button>

        <p className="mt-3 text-sm text-muted">{copy.note}</p>
      </div>
    </form>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-6">
      <h2 className="text-xl font-semibold text-ink">{title}</h2>
      {children}
    </section>
  )
}

type NumberFieldProps = {
  id: string
  label: string
  min: number
  max?: number
  step?: number
  hint?: string
  error?: string
  register: ReturnType<ReturnType<typeof useForm<ListingFormValues>>['register']>
}

/**
 * A numeric field. `valueAsNumber` is set by the caller so an emptied input
 * arrives as `NaN` rather than `''` — Zod rejects NaN, which is what surfaces
 * "Set a nightly price" instead of silently coercing a blank to 0.
 */
function NumberField({
  id,
  label,
  min,
  max,
  step = 1,
  hint,
  error,
  register,
}: NumberFieldProps) {
  return (
    <Field label={label} htmlFor={id} hint={hint} error={error}>
      <TextInput
        id={id}
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step={step}
        invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        {...register}
      />
    </Field>
  )
}
