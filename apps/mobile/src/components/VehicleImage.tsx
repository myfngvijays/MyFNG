import React, { useEffect, useMemo, useState } from 'react';
import { Image, ImageStyle, StyleProp } from 'react-native';
import { getVehicleImageUris } from '../lib/vehicleImages';

type VehicleImageProps = {
  vehicle?: any;
  make?: string;
  model?: string;
  style?: StyleProp<ImageStyle>;
};

export default function VehicleImage({ vehicle, make, model, style }: VehicleImageProps) {
  const uris = useMemo(() => {
    if (vehicle) return getVehicleImageUris(vehicle);
    return getVehicleImageUris({ make, model });
  }, [vehicle, make, model]);

  const [candidateIndex, setCandidateIndex] = useState(0);
  const src = uris.candidates[candidateIndex] || uris.primary;

  useEffect(() => {
    setCandidateIndex(0);
  }, [uris.candidates.join('|')]);

  return (
    <Image
      source={{ uri: src }}
      style={style}
      resizeMode="contain"
      onError={() => {
        if (candidateIndex < uris.candidates.length - 1) {
          setCandidateIndex((prev) => prev + 1);
        }
      }}
    />
  );
}
