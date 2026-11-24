const configuredBasePath = String(process.env.API_BASE_PATH ?? '').trim();

export const apiBasePath = configuredBasePath && configuredBasePath !== '/'
  ? `/${configuredBasePath.replace(/^\/+|\/+$/g, '')}`
  : '';
