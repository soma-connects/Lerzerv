/**
 * Base API utility for Lezerv.
 * In a real production environment, this would use environment variables
 * to point to AWS API Gateway or Lambda endpoints.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://api.lezerv.com/v1';

export const apiClient = async <T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> => {
  const url = `${API_BASE_URL}${endpoint}`;

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  // For initial implementation, we simulate the API call
  // This helps prevent network errors when a real backend isn't connected yet
  const isMockMode = import.meta.env.DEV || url.includes('api.lezerv.com');

  if (isMockMode) {
    console.log(`[Mock API] Requesting ${url}`, options);
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          success: true,
          data: { 
            message: 'Success (Mocked)',
            timestamp: new Date().toISOString()
          }
        } as any);
      }, 1000);
    });
  }

  try {
    const response = await fetch(url, { ...options, headers });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'API request failed');
    }

    return await response.json();
  } catch (error) {
    console.error('API Client Error:', error);
    throw error;
  }
};
