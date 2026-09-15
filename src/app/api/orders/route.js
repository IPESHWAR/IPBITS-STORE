import { POST as checkoutPost } from '../checkout/route';

/** Legacy alias — manual orders now dispatch via `/api/checkout`. */
export async function POST(request) {
  return checkoutPost(request);
}
