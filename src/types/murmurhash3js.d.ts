declare module 'murmurhash3js' {
  const murmurhash3: {
    x86: {
      hash32(input: string, seed?: number): number;
    };
  };

  export = murmurhash3;
}
