# mobx-jsonapi-store
JSON API Store for MobX

[![npm version](https://badge.fury.io/js/mobx-jsonapi-store.svg)](https://badge.fury.io/js/mobx-jsonapi-store)

[![Build Status](https://travis-ci.org/infinum/mobx-jsonapi-store.svg?branch=master)](https://travis-ci.org/infinum/mobx-jsonapi-store)
[![Test Coverage](https://codeclimate.com/github/infinum/mobx-jsonapi-store/badges/coverage.svg)](https://codeclimate.com/github/infinum/mobx-jsonapi-store/coverage)

[![Dependency Status](https://david-dm.org/infinum/mobx-jsonapi-store.svg)](https://david-dm.org/infinum/mobx-jsonapi-store)
[![devDependency Status](https://david-dm.org/infinum/mobx-jsonapi-store/dev-status.svg)](https://david-dm.org/infinum/mobx-jsonapi-store#info=devDependencies)

Inspired by [yayson](https://github.com/confetti/yayson).

## Basic example

```javascript
import {Store} from 'mobx-jsonapi-store';

const store = new Store();
const user = store.sync(userResponse); // Assumption: userResponse was received from some API call and it's a valid JSON API response
console.log(user.name); // "John"
```

For more, check out the [advanced example](#advanced-example).

## Installation

```bash
npm install mobx-jsonapi-store
```

## Requirements

* ES2015 Promises
* `window.fetch`
  * if using an alternative fetch implementation (e.g. `isomorphic-fetch`), assign it to the `fetchReference` property in the config
  * alternatively, override the `baseFetch` method in the config to use own network implementation

## Changes since v2

### Breaking

* Links are not available directly anymore. Instead, a `getRelationshipLinks()` function can be used.
* New [requirements](#Requirements)

### New stuff

* `getRelationshipLinks()`, `getMeta()`, and `getLinks()` functions on the model
* `toJsonApi()` method on the model - serializes the model into the JSON API structure
* WIP - Networking layer compatible with the JSON API specification
  * Pagination
  * Search
  * Sort

## Usage

### Store

* `constructor([serializedData])` - The constructor can be provided with the serialized data from `toJS` in order to deserialize
* `static types` - Array of classes extended from the `Record`
* `length` - Number of unique records in the store
* `sync(body)` - Sync the JSON API response with the store. Return value will be either a record or an array of records that were parsed from the response.
* `add(record, [type])` - Add a record (or an array of records). Type param is required if the first argument is an plain object (or an array of plain objects) and you want to map them to the correct record classes
* `find(type, [id])` - Find a specific model (first found model if id is not given)
* `findAll(type)` - Returns an array of records of the given type
* `remove(type, [id])` - Remove the selected record (or first record of type if id not given)
* `removeAll(type)` - Remove all records of the given type
* `reset()` - Clears all records and relationships from the store
* `toJS()` - Convert the store into a plain JS Object array in order to be serialized
* `fetch(type, id, [force], [options]) => Response` - Get a record from the server
* `fetchAll(type, [force], [options]) => Response` - Get a list of records from the server
* `destroy(type, id, [options])` - Remove a record from the server and store

### Record

* `constructor([serializedData])` - The constructor can be provided with the serialized data from `toJS` in order to deserialize
* `static idAttribute` - Property name of the unique identifier in your data (default is `id`)
* `static type` - Type of the record
* `static defaults` - An object with default record properties
* `update(data)` - Update the record with new data (object)
* `assign(key, value)` - Method used to add a new property or update an existing one
* `assignRef(key, value, [type])` - Assign a new reference to the record
* `toJS()` - Convert the record into a plain JS Object in order to be serialized
* `toJsonApi()` - Convert the record into a JSON API structured plain JS object
* `save([options])` - Save the record to the API
* `remove([options])` - Remove the record from the API and store

*Note:* If adding a new property, use `assign` or `assignRef` methods. Don't assign the properties directly to the record.

### Response

* `data` - A record or a list of records from the API response
* `meta` - API response metadata
* `links` - API response links
* `error` - API response error (either an JSON API error or a JS Error)
* `headers` - Headers sent to the server
* `responseHeaders` - `Headers` object received from the API
* Link getters (availability depends on the API response). Some getters that might exist:
  * `first` - Promise that resolves to a `Response` object with the first page
  * `prev` - Promise that resolves to a `Response` object with the previous page
  * `next` - Promise that resolves to a `Response` object with the next page
  * `last` - Promise that resolves to a `Response` object with the last page

### Network configuration

The network configuration is exposed in the `config` object that can be imported and parts of it can be replaced:

* `baseUrl` - Base URL for API calls. Record type, id and other options will be appended to it
* `defaultHeaders` - Default headers that will be sent to the server every time. It will be merged with headers objects given directly to the function making an API call
* `fetchReference` - A reference to the `fetch` method. Will default to `window.fetch` if in browser. `isomorphic-fetch` can be used for the server.
* `baseFetch(method, url, body, requestHeaders)` - If you don't want to use Fetch API, you can override this function. It needs to return a promise that resolves to an object with the following properties:
  * `data` - Response body
  * `status` - HTTP status
  * `headers` - Headers received from the API
  * `requestHeaders` - Headers sent to the server
  * `error` - Error object if something haas failed in the process

## Advanced example

*Note:* Static class props and decorators are not standard JavaScript features, but they have valid alternatives (see [basic example](#basic-example) and [MobX documentation](https://mobx.js.org/))

```javascript
import {computed} from 'mobx';
import {Store, Record} from 'mobx-jsonapi-store';

class User extends Record {
  static type = 'user';
  static refs = {photos: 'photo'};

  @computed get fullName() {
    return this.firstName + ' ' + this.lastName;
  }
}

class Photo extends Record {
  static type = 'photo';
  static refs = {author: 'user'};

  static defaults = {
    selected: false
  };
}

class ExampleStore extends Store {
  static types = [User, Photo];
}

const store = new ExampleStore();

// Get some data (e.g. API call)
store.sync(data);

const user = store.find('user', 1);
console.log(user.fullName); // John Doe
console.log(user.photos[0].extension); // 'jpg'

const photos = store.photo; // alternative: store.findAll('photo')
const selectedPhotos = photos.filter((photo) => photo.selected);
```

### Typescript example

```typescript
import {computed} from 'mobx';
import {Store, Record} from 'mobx-jsonapi-store';

class User extends Record {
  static type = 'user';
  static refs = {photos: 'photo'};

  firstName: string;
  lastName: string;
  photos: Photo|Array<Photo>;

  @computed get fullName(): string {
    return this.firstName + ' ' + this.lastName;
  }
}

class Photo extends Record {
  static type = 'photo';
  static refs = {author: 'user'};

  static defaults = {
    selected: false
  };

  selected: boolean;
  extension: string;
  author: User; // The correct type would be User|Array<User>
}

class ExampleStore extends Store {
  static types = [User, Photo];

  photo: Array<Photo>;
  user: Array<User>;
}

const store = new ExampleStore();

// Get some data (e.g. API call)
store.sync(data);

const user = store.find<User>('user', 1);
console.log(user.fullName); // John Doe
console.log(user.photos[0].extension); // 'jpg'

const photos = store.photo; // alternative: store.findAll<Photo>('photo')
const selectedPhotos = photos.filter((photo) => photo.selected);
```

## Pagination example

```typescript
import {config, Store, Record} from 'mobx-jsonapi-store';

config.baseUrl = 'https://example.com/';
const store = new Store();

// Get a list of all users if the API requires pagination
// Note: In normal usage, you should also have some error handling
async function getAllUsers() {
  const users = [];
  let response = await store.findAll('user'); // GET https://example.com/user
  users.push(...response.data);
  while (response.next) {
    response = await response.next;
    users.push(...response.data);
  }
  return users;
}
```

## JSON API support
* `data`
* `included`
* `relationships.data`
* `relationships.links`

## License

The MIT License

![](https://assets.infinum.co/assets/brand-logo-9e079bfa1875e17c8c1f71d1fee49cf0.svg) © 2016 Infinum Inc.
