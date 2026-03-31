 import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get('lat');
  const lng = searchParams.get('lng');
  const radius = searchParams.get('radius');

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY;

  const response = await fetch(
    'https://places.googleapis.com/v1/places:searchNearby',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey!,
        'X-Goog-FieldMask': 'places.displayName,places.location,places.rating,places.userRatingCount,places.regularOpeningHours,places.primaryTypeDisplayName',
      },
      body: JSON.stringify({
        includedTypes: ['restaurant', 'cafe', 'bar'],
        maxResultCount: 20,
        locationRestriction: {
          circle: {
            center: { latitude: parseFloat(lat!), longitude: parseFloat(lng!) },
            radius: parseFloat(radius!),
          },
        },
      }),
    }
  );

  const data = await response.json();
  return NextResponse.json(data);
}
