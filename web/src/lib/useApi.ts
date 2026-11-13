import { mockApi } from '../mock/mockApi';
import { useMock } from './config';
import { realApi } from './realApi';

export const api = useMock ? mockApi : realApi;
