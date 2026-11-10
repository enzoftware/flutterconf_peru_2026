import { getCollection, type CollectionEntry, type CollectionKey } from 'astro:content';

/** All entries of a collection, ordered by id ("01", "02", …), as plain typed data. */
export async function list<C extends CollectionKey>(name: C): Promise<CollectionEntry<C>['data'][]> {
  const entries = (await getCollection(name)) as CollectionEntry<C>[];
  return entries.sort((a, b) => a.id.localeCompare(b.id)).map((e) => e.data);
}
