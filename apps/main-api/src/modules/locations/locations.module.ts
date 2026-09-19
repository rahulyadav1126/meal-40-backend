import {
  BadGatewayException,
  BadRequestException,
  Controller,
  Get,
  Injectable,
  Module,
  NotFoundException,
  Param,
  Query,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { Public } from '@app/auth';

class AutocompleteQueryDto {
  @IsString() @Length(3, 160) input: string;
  @IsString() @MaxLength(160) @IsOptional() sessionToken?: string;
}

class DetailsQueryDto {
  @IsString() @MaxLength(160) @IsOptional() sessionToken?: string;
}

interface GoogleAutocompleteResponse {
  suggestions?: Array<{
    placePrediction?: {
      placeId?: string;
      text?: { text?: string };
      structuredFormat?: {
        mainText?: { text?: string };
        secondaryText?: { text?: string };
      };
    };
  }>;
}

interface GooglePlaceDetails {
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  addressComponents?: Array<{
    longText?: string;
    shortText?: string;
    types?: string[];
  }>;
}

@Injectable()
class LocationsService {
  private readonly apiKey: string;

  constructor(config: ConfigService) {
    this.apiKey = config.get<string>('maps.googleApiKey') ?? '';
  }

  async autocomplete(input: string, sessionToken?: string) {
    this.ensureConfigured();
    const response = await fetch(
      'https://places.googleapis.com/v1/places:autocomplete',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': this.apiKey,
          'X-Goog-FieldMask':
            'suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat',
        },
        body: JSON.stringify({
          input: input.trim(),
          includedRegionCodes: ['in'],
          regionCode: 'IN',
          languageCode: 'en',
          sessionToken,
          includePureServiceAreaBusinesses: false,
        }),
      },
    );
    if (!response.ok) await this.googleError(response);
    const data = (await response.json()) as GoogleAutocompleteResponse;
    return (data.suggestions ?? []).flatMap(({ placePrediction }) => {
      if (!placePrediction?.placeId || !placePrediction.text?.text) return [];
      return [
        {
          placeId: placePrediction.placeId,
          text: placePrediction.text.text,
          mainText:
            placePrediction.structuredFormat?.mainText?.text ??
            placePrediction.text.text,
          secondaryText:
            placePrediction.structuredFormat?.secondaryText?.text ?? '',
        },
      ];
    });
  }

  async details(placeId: string, sessionToken?: string) {
    this.ensureConfigured();
    const params = new URLSearchParams({
      languageCode: 'en',
      regionCode: 'IN',
    });
    if (sessionToken) params.set('sessionToken', sessionToken);
    const response = await fetch(
      `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?${params}`,
      {
        headers: {
          'X-Goog-Api-Key': this.apiKey,
          'X-Goog-FieldMask': 'formattedAddress,addressComponents,location',
        },
      },
    );
    if (response.status === 404)
      throw new NotFoundException('Address not found');
    if (!response.ok) await this.googleError(response);
    const place = (await response.json()) as GooglePlaceDetails;
    const component = (type: string, short = false) => {
      const found = place.addressComponents?.find((item) =>
        item.types?.includes(type),
      );
      return short ? found?.shortText : found?.longText;
    };
    if (component('country', true)?.toUpperCase() !== 'IN') {
      throw new BadRequestException('Only addresses in India are supported');
    }
    const unique = (parts: Array<string | undefined>) =>
      parts.filter(
        (part, index, values): part is string =>
          Boolean(part) &&
          values.findIndex(
            (value) => value?.toLowerCase() === part?.toLowerCase(),
          ) === index,
      );
    const addressLine1 = unique([
      component('subpremise'),
      component('premise'),
      component('street_number'),
      component('route'),
      component('neighborhood'),
      component('sublocality_level_1'),
    ]).join(', ');
    const city =
      component('locality') ??
      component('postal_town') ??
      component('administrative_area_level_3') ??
      component('administrative_area_level_2') ??
      '';
    const latitude = place.location?.latitude;
    const longitude = place.location?.longitude;
    if (
      typeof latitude !== 'number' ||
      !Number.isFinite(latitude) ||
      typeof longitude !== 'number' ||
      !Number.isFinite(longitude)
    ) {
      throw new BadGatewayException(
        'Google did not return coordinates for this address',
      );
    }
    return {
      placeId,
      formattedAddress: place.formattedAddress ?? addressLine1,
      addressLine1: addressLine1 || place.formattedAddress || '',
      addressLine2: component('administrative_area_level_2') ?? '',
      city,
      state: component('administrative_area_level_1') ?? '',
      postalCode: component('postal_code') ?? '',
      latitude,
      longitude,
    };
  }

  private ensureConfigured() {
    if (!this.apiKey) {
      throw new ServiceUnavailableException(
        'Google address search is not configured',
      );
    }
  }

  private async googleError(response: Response): Promise<never> {
    const detail = await response.text();
    throw new BadGatewayException(
      process.env.NODE_ENV === 'production'
        ? 'Google address search is temporarily unavailable'
        : `Google Places request failed (${response.status}): ${detail.slice(0, 300)}`,
    );
  }
}

@Public()
@ApiTags('Locations')
@Controller('locations')
class LocationsController {
  constructor(private readonly locations: LocationsService) {}

  @Get('autocomplete')
  autocomplete(@Query() query: AutocompleteQueryDto) {
    return this.locations.autocomplete(query.input, query.sessionToken);
  }

  @Get('details/:placeId')
  details(@Param('placeId') placeId: string, @Query() query: DetailsQueryDto) {
    return this.locations.details(placeId, query.sessionToken);
  }
}

@Module({ controllers: [LocationsController], providers: [LocationsService] })
export class LocationsModule {}
