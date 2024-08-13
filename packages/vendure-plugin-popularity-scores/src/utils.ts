import { ID } from '@vendure/core';

export const sliceArray = (arr: ID[], chunkSize: number): ID[][] => {
  const result = [];
  for (let i = 0; i < arr.length; i += chunkSize) {
    if (i + chunkSize < arr.length) {
      result.push(arr.slice(i, i + chunkSize));
    } else {
      result.push(arr.slice(i));
    }
  }
  return result;
};
