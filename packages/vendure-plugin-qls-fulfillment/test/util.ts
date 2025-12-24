export const createMockResponse = (data: any) => {
  return {
    ok: true,
    status: 200,
    headers: {
      get: () => 'application/json',
    },
    json: async () => data,
  };
};
