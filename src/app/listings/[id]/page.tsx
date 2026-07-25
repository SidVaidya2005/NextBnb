import { FeaturePlaceholder } from '@/components/placeholder/FeaturePlaceholder'

/**
 * Stand-in for the listing detail page. Feature 05 links every card here, so
 * this exists to keep the home grid from being 24 dead ends until Feature 07
 * replaces it with the real gallery, amenities and booking widget.
 */
export default function ListingDetailPage() {
  return (
    <FeaturePlaceholder
      title="Listing detail"
      feature="07 Listing detail"
      description="Photos, description, amenities, house rules, host info and reviews for this stay will live here, alongside the booking widget."
    />
  )
}
