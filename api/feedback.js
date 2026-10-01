import { put } from '@vercel/blob';
import { createFeedbackHandler } from '../lib/feedback.mjs';

export default createFeedbackHandler({ put });
