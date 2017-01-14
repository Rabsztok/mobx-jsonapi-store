import IJsonApiRecord from './interfaces/IJsonApiRecord';
import IDictionary from './interfaces/IDictionary';

/**
 * Iterate trough object keys
 *
 * @param {Object} obj - Object that needs to be iterated
 * @param {Function} fn - Function that should be called for every iteration
 */
function objectForEach(obj: Object, fn: Function): void {
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      fn(key);
    }
  }
}

export function mapItems<T>(data: Object|Array<Object>, fn: Function): T|Array<T> {
  return data instanceof Array ? data.map((item) => fn(item)) : fn(data);
}

export function flattenRecord(record: IJsonApiRecord): IDictionary<any> {
  const data: IDictionary<any> = {
    id: record.id,
    type: record.type
  };

  objectForEach(record.attributes, (key) => {
    data[key] = record.attributes[key];
  });

  objectForEach(record.relationships, (key) => {
    data[key] = mapItems<number|string>(record.relationships[key].data, (item) => item && item.id);
    if (record.relationships[key].links) {
      data[`${key}Links`] = record.relationships[key].links;
    }
  });

  return data;
}