import axios from 'axios';

export async function requestTts(text: string, style: string): Promise<Blob> {
  const token = localStorage.getItem('token');
  const trialToken = localStorage.getItem('trial_token');
  const response = await axios.post('/api/v1/tts', { text, style }, {
    responseType: 'blob',
    timeout: 120000,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(trialToken ? { 'X-Trial-Token': trialToken } : {}),
    },
  });
  return response.data;
}
