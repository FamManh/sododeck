import { createImageClient, type ImageClient } from './image-client';

let shared: ImageClient | undefined;

/** The page's one picture worker, started on first use. */
export function getImageClient(): ImageClient {
  shared ??= createImageClient();
  return shared;
}
