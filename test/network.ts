import {expect} from 'chai';
import * as fetch from 'isomorphic-fetch';

// tslint:disable:no-string-literal

import {config, Record, Store} from '../src';

import mockApi from './api';
import {Event, Image, Organiser, Photo, TestStore, User} from './setup';

const baseStoreFetch = config.storeFetch;

describe('Networking', () => {
  beforeEach(() => {
    config.fetchReference = fetch;
    config.baseUrl = 'http://example.com/';
  });

  describe('basics', () => {
    beforeEach(() => {
      config.storeFetch = baseStoreFetch;
    });

    it('should fetch the basic data', async () => {
      mockApi({
        name: 'events-1',
        url: 'event',
      });

      const store = new Store();
      const events = await store.fetchAll('event');

      expect(events.data).to.be.an('array');
      expect(events.data['length']).to.equal(4);
      expect(events.data instanceof Array && events.data[0]['title']).to.equal('Test 1');
      expect(events.data[0].getMeta().createdAt).to.equal('2017-03-19T16:00:00.000Z');
      expect(events.data[0]['imageId']).to.equal('1');
      expect(events.data[0]['imageMeta']['foo']).to.equal('bar');

      const data = events.data[0].toJsonApi();
      expect(data.id).to.equal(1);
      expect(data.type).to.equal('event');
      expect(data.attributes.title).to.equal('Test 1');
      expect(data.relationships.image.data).to.eql({type: 'image', id: '1'});
    });

    it('should use the correct types', async () => {
      const store = new TestStore();

      const user = new User({firstName: 'John'});
      const userData = user.toJsonApi();
      expect(userData.type).to.equal('user');

      const wrongEvent = new Event({type: 'evil-event', name: 'Test'});
      const wrongEventData = wrongEvent.toJsonApi();
      expect(wrongEventData.type).to.equal('evil-event');
    });

    it('should support storeFetch override', async () => {
      mockApi({
        name: 'events-1',
        url: 'event',
      });

      let hasCustomStoreFetchBeenCalled = false;

      config.storeFetch = (opts) => {
        expect(opts.store).to.equal(store);
        hasCustomStoreFetchBeenCalled = true;
        return baseStoreFetch(opts);
      };

      const store = new Store();
      const events = await store.fetchAll('event');

      expect(events.data).to.be.an('array');
      expect(hasCustomStoreFetchBeenCalled).to.equal(true);
    });

    it('should save the jsonapi data', async () => {
      mockApi({
        name: 'jsonapi-object',
        url: 'event',
      });

      const store = new Store();
      const events = await store.fetchAll('event');

      expect(events.data).to.be.an('array');
      expect(events.data['length']).to.equal(4);
      expect(events.jsonapi).to.be.an('object');
      expect(events.jsonapi.version).to.equal('1.0');
      expect(events.jsonapi.meta.foo).to.equal('bar');
    });

    it('should fetch one item', async () => {
      mockApi({
        name: 'event-1b',
        url: 'event/1',
      });

      const store = new Store();
      const events = await store.fetch('event', 1);

      const record = events.data as Record;

      expect(record).to.be.an('object');
      expect(record['title']).to.equal('Test 1');
      expect(record.getLinks()).to.be.an('object');
      expect(record.getLinks().self).to.equal('http://example.com/event/1234');
    });

    it('should support pagination', async () => {
      mockApi({
        name: 'events-1',
        url: 'event',
      });

      const store = new Store();
      const events = await store.fetchAll('event');

      expect(events.data).to.be.an('array');
      expect(events.data['length']).to.equal(4);
      expect(events.data instanceof Array && events.data[0]['title']).to.equal('Test 1');
      expect(events.links).to.be.an('object');
      expect(events.links['next']['href']).to.equal('http://example.com/event?page=2');
      expect(events.links['next']['meta'].foo).to.equal('bar');

      mockApi({
        name: 'events-2',
        query: {
          page: 2,
        },
        url: 'event',
      });

      const events2 = await events.next;

      expect(events2.data).to.be.an('array');
      expect(events2.data['length']).to.equal(2);
      expect(events2.data instanceof Array && events2.data[0]['title']).to.equal('Test 5');

      mockApi({
        name: 'events-1',
        url: 'event',
      });

      const events1 = await events2.prev;

      expect(events1.data).to.be.an('array');
      expect(events1.data['length']).to.equal(4);
      expect(events1.data instanceof Array && events1.data[0]['title']).to.equal('Test 1');

      const events1b = await events2.prev;
      expect(events1).to.not.equal(events);
      expect(events1).to.equal(events1b);
    });

    it('should support record links', async () => {
      mockApi({
        name: 'event-1',
        url: 'event',
      });

      const store = new Store();
      const events = await store.fetchAll('event');
      const event = events.data as Record;

      mockApi({
        name: 'image-1',
        url: 'images/1',
      });

      const image = await event.fetchLink('image');
      expect(image.data['id']).to.equal(1);
      expect(image.data['type']).to.equal('image');
      expect(image.data['url']).to.equal('http://example.com/1.jpg');
    });

    it('should recover if no link defined', async () => {
      mockApi({
        name: 'event-1',
        url: 'event',
      });

      const store = new Store();
      const events = await store.fetchAll('event');
      const event = events.data as Record;

      const foobar = await event.fetchLink('foobar');
      expect(foobar.data).to.be.an('array');
      expect(foobar.data).to.have.length(0);
    });

    it('should support relationship link fetch', async () => {
      mockApi({
        name: 'events-1',
        url: 'event',
      });

      const store = new Store();
      const events = await store.fetchAll('event');
      const event = events.data[0] as Record;

      mockApi({
        name: 'image-1',
        url: 'images/1',
      });

      const image = await event.fetchRelationshipLink('image', 'self');
      expect(image.data['id']).to.equal(1);
      expect(image.data['type']).to.equal('image');
      expect(image.data['url']).to.equal('http://example.com/1.jpg');

    });

    it('should support baseUrl', async () => {
      class Event extends Record {
        public static type = 'event';
        public static baseUrl = 'foo/event';
      }

      // tslint:disable-next-line:max-classes-per-file
      class Collection extends Store {
        public static types = [Event];
      }

      const store = new Collection();

      mockApi({
        name: 'event-1',
        url: 'foo/event',
      });

      const response = await store.fetchAll('event');
      const event = response.data as Event;
      expect(event.type).to.equal('event');
    });

    it('should support endpoint', async () => {
      // tslint:disable-next-line:max-classes-per-file
      class Event extends Record {
        public static type = 'event';
        public static endpoint = 'foo/event';
      }

      // tslint:disable-next-line:max-classes-per-file
      class Collection extends Store {
        public static types = [Event];
      }

      const store = new Collection();

      mockApi({
        name: 'event-1',
        url: 'foo/event',
      });

      const response = await store.fetchAll('event');
      const event = response.data as Event;
      expect(event.type).to.equal('event');
    });

    it('should support functional endpoint', async () => {
      // tslint:disable-next-line:max-classes-per-file
      class Event extends Record {
        public static type = 'event';
        public static endpoint = () => 'foo/event';
      }

      // tslint:disable-next-line:max-classes-per-file
      class Collection extends Store {
        public static types = [Event];
      }

      const store = new Collection();

      mockApi({
        name: 'event-1',
        url: 'foo/event',
      });

      const response = await store.fetchAll('event');
      const event = response.data as Event;
      expect(event.type).to.equal('event');
    });

    it('should prepend config.baseUrl to the request url', async () => {
      mockApi({
        name: 'event-1b',
        url: 'event/1',
      });

      const store = new Store();
      const events = await store.request('event/1');

      const record = events.data as Record;

      expect(record['title']).to.equal('Test 1');
    });

    it('should handle the request methods', async () => {
      mockApi({
        method: 'PUT',
        name: 'event-1b',
        url: 'event/1',
      });

      const store = new Store();
      const events = await store.request('event/1', 'PUT');

      const record = events.data as Record;

      expect(record['title']).to.equal('Test 1');
    });

  });

  describe('caching', () => {
    describe('fetch caching', () => {
      it('should cache fetch requests', async () => {
        mockApi({
          name: 'event-1',
          url: 'event/12345',
        });

        const store = new Store();
        const events = await store.fetch('event', 12345);

        expect(events.data).to.be.an('object');
        expect(events.data['id']).to.equal(12345);

        const events2 = await store.fetch('event', 12345);

        expect(events2).to.equal(events);
      });

      it('should clear fetch cache on removeAll', async () => {
        mockApi({
          name: 'event-1',
          url: 'event/12345',
        });

        const store = new Store();
        const events = await store.fetch('event', 12345);

        expect(events.data['id']).to.equal(12345);

        store.removeAll('event');

        const req2 = mockApi({
          name: 'event-1',
          url: 'event/12345',
        });

        const events2 = await store.fetch('event', 12345);
        expect(events2.data['id']).to.equal(12345);
        expect(req2.isDone()).to.equal(true);
      });

      it('should ignore fetch cache if force is true', async () => {
        mockApi({
          name: 'event-1',
          url: 'event/12345',
        });

        const store = new Store();
        const events = await store.fetch('event', 12345);

        expect(events.data).to.be.an('object');
        expect(events.data['id']).to.equal(12345);

        mockApi({
          name: 'event-1',
          url: 'event/12345',
        });

        const events2 = await store.fetch('event', 12345, true);

        expect(events2).to.not.equal(events);
        expect(events2.data).to.be.an('object');
        expect(events2.data['id']).to.equal(12345);
      });

      it('should ignore fetch cache if static cache is false', async () => {
        mockApi({
          name: 'event-1',
          url: 'event/12345',
        });

        // tslint:disable-next-line:max-classes-per-file
        class TestStore extends Store {
          public static cache = false;
        }

        const store = new TestStore();
        const events = await store.fetch('event', 12345);

        expect(events.data).to.be.an('object');
        expect(events.data['id']).to.equal(12345);

        mockApi({
          name: 'event-1',
          url: 'event/12345',
        });

        const events2 = await store.fetch('event', 12345);

        expect(events2).to.not.equal(events);
        expect(events2.data).to.be.an('object');
        expect(events2.data['id']).to.equal(12345);
      });

      it('should not cache fetch if the response was an jsonapi error', async () => {
        mockApi({
          name: 'error',
          url: 'event/12345',
        });

        const store = new Store();
        try {
          const events = await store.fetch('event', 12345);
          expect(true).to.equal(false);
        } catch (e) {
          expect(e).to.be.an('array');
        }

        mockApi({
          name: 'event-1',
          url: 'event/12345',
        });

        const events2 = await store.fetch('event', 12345);

        expect(events2.data).to.be.an('object');
        expect(events2.data['id']).to.equal(12345);
      });

      it('should not cache fetch if the response was an http error', async () => {
        mockApi({
          name: 'event-1',
          status: 500,
          url: 'event/12345',
        });

        const store = new Store();
        try {
          const events = await store.fetch('event', 12345);
          expect(true).to.equal(false);
        } catch (e) {
          expect(e).to.be.an('object');
        }

        mockApi({
          name: 'event-1',
          url: 'event/12345',
        });

        const events2 = await store.fetch('event', 12345);

        expect(events2.data).to.be.an('object');
        expect(events2.data['id']).to.equal(12345);
      });
    });

    describe('fetchAll caching', () => {
      it('should cache fetchAll requests', async () => {
        mockApi({
          name: 'events-1',
          url: 'event',
        });

        const store = new Store();
        const events = await store.fetchAll('event');

        expect(events.data).to.be.an('array');
        expect(events.data['length']).to.equal(4);

        const events2 = await store.fetchAll('event');

        expect(events2).to.equal(events);
      });

      it('should clear fetchAll cache on removeAll', async () => {
        mockApi({
          name: 'events-1',
          url: 'event',
        });

        const store = new Store();
        const events = await store.fetchAll('event');

        expect(events.data).to.be.an('array');
        expect(events.data['length']).to.equal(4);

        store.removeAll('event');

        const req2 = mockApi({
          name: 'events-1',
          url: 'event',
        });

        const events2 = await store.fetchAll('event');
        expect(events2.data['length']).to.equal(4);
        expect(req2.isDone()).to.equal(true);
      });

      it('should ignore fetchAll cache if force is true', async () => {
        mockApi({
          name: 'events-1',
          url: 'event',
        });

        const store = new Store();
        const events = await store.fetchAll('event');

        expect(events.data).to.be.an('array');
        expect(events.data['length']).to.equal(4);

        mockApi({
          name: 'events-1',
          url: 'event',
        });

        const events2 = await store.fetchAll('event', true);

        expect(events2).to.not.equal(events);
        expect(events2.data).to.be.an('array');
        expect(events2.data['length']).to.equal(4);
      });

      it('should ignore fetchAll cache if static cache is false', async () => {
        mockApi({
          name: 'events-1',
          url: 'event',
        });

        // tslint:disable-next-line:max-classes-per-file
        class TestStore extends Store {
          public static cache = false;
        }

        const store = new TestStore();
        const events = await store.fetchAll('event');

        expect(events.data).to.be.an('array');
        expect(events.data['length']).to.equal(4);

        mockApi({
          name: 'events-1',
          url: 'event',
        });

        const events2 = await store.fetchAll('event');

        expect(events2).to.not.equal(events);
        expect(events2.data).to.be.an('array');
        expect(events2.data['length']).to.equal(4);
      });

      it('should not cache fetchAll if the response was an jsonapi error', async () => {
        mockApi({
          name: 'error',
          url: 'event',
        });

        const store = new Store();
        try {
          const events = await store.fetchAll('event');
          expect(true).to.equal(false);
        } catch (e) {
          expect(e).to.be.an('array');
        }

        mockApi({
          name: 'events-1',
          url: 'event',
        });

        const events2 = await store.fetchAll('event');

        expect(events2.data).to.be.an('array');
        expect(events2.data['length']).to.equal(4);
      });

      it('should not cache fetchAll if the response was an http error', async () => {
        mockApi({
          name: 'events-1',
          status: 500,
          url: 'event',
        });

        const store = new Store();
        try {
          const events = await store.fetchAll('event');
          expect(true).to.equal(false);
        } catch (e) {
          expect(e).to.be.an('object');
        }

        mockApi({
          name: 'events-1',
          url: 'event',
        });

        const events2 = await store.fetchAll('event');

        expect(events2.data).to.be.an('array');
        expect(events2.data['length']).to.equal(4);
      });
    });
  });

  describe('updates', () => {
    describe('adding record', () => {
      it('should add a record', async () => {
        const store = new Store();
        const record = new Record({
          title: 'Example title',
          type: 'event',
        });
        store.add(record);

        mockApi({
          data: JSON.stringify({
            data: record.toJsonApi(),
          }),
          method: 'POST',
          name: 'event-1',
          url: 'event',
        });

        const data = record.toJsonApi();
        expect(record['title']).to.equal('Example title');
        expect(data.id).to.be.an('undefined');
        expect(data.type).to.equal('event');
        expect(data.attributes.id).to.be.an('undefined');
        expect(data.attributes.type).to.be.an('undefined');

        const updated = await record.save();
        expect(updated['title']).to.equal('Test 1');
        expect(updated).to.equal(record);
      });

      it('should add a record if not in store', async () => {
        const record = new Record({
          title: 'Example title',
          type: 'event',
        });

        mockApi({
          data: JSON.stringify({
            data: record.toJsonApi(),
          }),
          method: 'POST',
          name: 'event-1',
          url: 'event',
        });

        const data = record.toJsonApi();
        expect(record['title']).to.equal('Example title');
        expect(data.id).to.be.an('undefined');
        expect(data.type).to.equal('event');
        expect(data.attributes.id).to.be.an('undefined');
        expect(data.attributes.type).to.be.an('undefined');

        const updated = await record.save();
        expect(updated['title']).to.equal('Test 1');
        expect(updated).to.equal(record);
      });

      it('should add a record with queue (202)', async () => {
        const store = new Store();
        const record = new Record({
          title: 'Example title',
          type: 'event',
        });
        store.add(record);

        mockApi({
          data: JSON.stringify({
            data: record.toJsonApi(),
          }),
          method: 'POST',
          name: 'queue-1',
          status: 202,
          url: 'event',
        });

        const data = record.toJsonApi();
        expect(record['title']).to.equal('Example title');
        expect(data.id).to.be.an('undefined');
        expect(data.type).to.equal('event');
        expect(data.attributes.id).to.be.an('undefined');
        expect(data.attributes.type).to.be.an('undefined');

        const queue = await record.save();
        expect(queue.type).to.equal('queue');

        mockApi({
          name: 'queue-1',
          url: 'events/queue-jobs/123',
        });

        const queue2 = await queue.fetchLink('self', null, true);
        expect(queue2.data['type']).to.equal('queue');

        mockApi({
          name: 'event-1',
          url: 'events/queue-jobs/123',
        });

        const updatedRes = await queue.fetchLink('self', null, true);
        const updated = updatedRes.data as Record;
        expect(updated.type).to.equal('event');

        expect(updated['title']).to.equal('Test 1');
        expect(updated.id).to.equal(12345);
        expect(updated).to.equal(record);
      });

      it('should add a record with queue (202) if not in store', async () => {
        const record = new Record({
          title: 'Example title',
          type: 'event',
        });

        mockApi({
          data: JSON.stringify({
            data: record.toJsonApi(),
          }),
          method: 'POST',
          name: 'queue-1',
          status: 202,
          url: 'event',
        });

        const data = record.toJsonApi();
        expect(record['title']).to.equal('Example title');
        expect(data.id).to.be.an('undefined');
        expect(data.type).to.equal('event');
        expect(data.attributes.id).to.be.an('undefined');
        expect(data.attributes.type).to.be.an('undefined');

        const queue = await record.save();
        expect(queue.type).to.equal('queue');

        mockApi({
          name: 'queue-1',
          url: 'events/queue-jobs/123',
        });

        const queue2 = await queue.fetchLink('self', null, true);
        expect(queue2.data['type']).to.equal('queue');

        mockApi({
          name: 'event-1',
          url: 'events/queue-jobs/123',
        });

        const updatedRes = await queue.fetchLink('self', null, true);
        const updated = updatedRes.data as Record;
        expect(updated.type).to.equal('event');

        expect(updated['title']).to.equal('Test 1');
        expect(updated.id).to.equal(12345);
        expect(updated).to.equal(record);
      });

      it('should add a record with response 204', async () => {
        const store = new Store();
        const record = new Record({
          id: 123,
          title: 'Example title',
          type: 'event',
        });
        store.add(record);

        mockApi({
          data: JSON.stringify({
            data: record.toJsonApi(),
          }),
          method: 'POST',
          responseFn: () => null,
          status: 204,
          url: 'event',
        });

        const data = record.toJsonApi();
        expect(record['title']).to.equal('Example title');
        expect(data.type).to.equal('event');
        expect(data.attributes.id).to.be.an('undefined');
        expect(data.attributes.type).to.be.an('undefined');

        const updated = await record.save();
        expect(updated['title']).to.equal('Example title');
        expect(updated).to.equal(record);
      });

      it('should add a record with response 204 if not in store', async () => {
        const record = new Record({
          id: 123,
          title: 'Example title',
          type: 'event',
        });

        mockApi({
          data: JSON.stringify({
            data: record.toJsonApi(),
          }),
          method: 'POST',
          responseFn: () => null,
          status: 204,
          url: 'event',
        });

        const data = record.toJsonApi();
        expect(record['title']).to.equal('Example title');
        expect(data.type).to.equal('event');
        expect(data.attributes.id).to.be.an('undefined');
        expect(data.attributes.type).to.be.an('undefined');

        const updated = await record.save();
        expect(updated['title']).to.equal('Example title');
        expect(updated).to.equal(record);
      });

      it('should add a record with client-generated id', async () => {
        const store = new Store();

        // tslint:disable-next-line:max-classes-per-file
        class GenRecord extends Record {
          public static useAutogeneratedIds = true;
          public static autoIdFunction = () => '110ec58a-a0f2-4ac4-8393-c866d813b8d1';
        }

        const record = new GenRecord({
          title: 'Example title',
          type: 'event',
        });
        store.add(record);

        mockApi({
          data: JSON.stringify({
            data: record.toJsonApi(),
          }),
          method: 'POST',
          name: 'event-1c',
          url: 'event',
        });

        const data = record.toJsonApi();
        expect(record['title']).to.equal('Example title');
        expect(data.id).to.be.an('string');
        expect(data.id).to.have.length(36);
        expect(data.type).to.equal('event');
        expect(data.attributes.id).to.be.an('undefined');
        expect(data.attributes.type).to.be.an('undefined');

        const updated = await record.save();
        expect(updated['title']).to.equal('Test 1');
        expect(updated).to.equal(record);
      });

      it('should add a record with client-generated id if not in store', async () => {

        // tslint:disable-next-line:max-classes-per-file
        class GenRecord extends Record {
          public static useAutogeneratedIds = true;
          public static autoIdFunction = () => '110ec58a-a0f2-4ac4-8393-c866d813b8d1';
        }

        const record = new GenRecord({
          title: 'Example title',
          type: 'event',
        });

        mockApi({
          data: JSON.stringify({
            data: record.toJsonApi(),
          }),
          method: 'POST',
          name: 'event-1c',
          url: 'event',
        });

        const data = record.toJsonApi();
        expect(record['title']).to.equal('Example title');
        expect(data.id).to.be.an('string');
        expect(data.id).to.have.length(36);
        expect(data.type).to.equal('event');
        expect(data.attributes.id).to.be.an('undefined');
        expect(data.attributes.type).to.be.an('undefined');

        const updated = await record.save();
        expect(updated['title']).to.equal('Test 1');
        expect(updated).to.equal(record);
      });
    });

    describe('updating record', () => {
      it('should update a record', async () => {
        mockApi({
          name: 'event-1',
          url: 'event/12345',
        });

        const store = new Store();
        const events = await store.fetch('event', 12345);

        const record = events.data as Record;

        mockApi({
          data: JSON.stringify({
            data: record.toJsonApi(),
          }),
          method: 'PATCH',
          name: 'event-1',
          url: 'event/12345',
        });

        const updated = await record.save();
        expect(updated['title']).to.equal('Test 1');
        expect(updated).to.equal(record);
      });

      it('should update a record if not in store', async () => {
        mockApi({
          name: 'event-1',
          url: 'event/12345',
        });

        const store = new Store();
        const events = await store.fetch('event', 12345);

        const record = events.data as Record;

        store.remove(record.type, record.id);

        mockApi({
          data: JSON.stringify({
            data: record.toJsonApi(),
          }),
          method: 'PATCH',
          name: 'event-1',
          url: 'event/12345',
        });

        const updated = await record.save();
        expect(updated['title']).to.equal('Test 1');
        expect(updated).to.equal(record);
      });

      it('should update a record with self link', async () => {
        mockApi({
          name: 'event-1b',
          url: 'event/12345',
        });

        const store = new Store();
        const events = await store.fetch('event', 12345);

        const record = events.data as Record;

        mockApi({
          data: JSON.stringify({
            data: record.toJsonApi(),
          }),
          method: 'PATCH',
          name: 'event-1b',
          url: 'event/1234',
        });

        const updated = await record.save();
        expect(updated['title']).to.equal('Test 1');
        expect(updated).to.equal(record);
      });

      it('should update a record with self link if not in store', async () => {
        mockApi({
          name: 'event-1b',
          url: 'event/12345',
        });

        const store = new Store();
        const events = await store.fetch('event', 12345);

        const record = events.data as Record;
        store.remove(record.type, record.id);

        mockApi({
          data: JSON.stringify({
            data: record.toJsonApi(),
          }),
          method: 'PATCH',
          name: 'event-1b',
          url: 'event/1234',
        });

        const updated = await record.save();
        expect(updated['title']).to.equal('Test 1');
        expect(updated).to.equal(record);
      });

      it('should support updating relationships', async () => {
        mockApi({
          name: 'events-1',
          url: 'event',
        });

        const store = new Store();
        const events = await store.fetchAll('event');
        const event = events.data[0] as Record;

        event['imageId'] = [event['imageId'], '2'];

        mockApi({
          data:  {
            data: [{
              id: '1',
              type: 'image',
            }, {
              id: '2',
              type: 'image',
            }],
          },
          method: 'PATCH',
          name: 'event-1d',
          url: 'images/1',
        });

        const event2 = await event.saveRelationship('image') as Record;
        expect(event2.id).to.equal(12345);
        expect(event2.type).to.equal('event');
        expect(event2['imageId'][0]).to.equal('1');
        expect(event['imageId'][0]).to.equal('1');
        expect(event).to.equal(event2);

      });

      it('should support updating relationships if not in store', async () => {
        mockApi({
          name: 'events-1',
          url: 'event',
        });

        const store = new Store();
        const events = await store.fetchAll('event');
        const event = events.data[0] as Record;
        store.remove(event.type, event.id);

        event['imageId'] = [event['imageId'], '2'];

        mockApi({
          data:  {
            data: [{
              id: '1',
              type: 'image',
            }, {
              id: '2',
              type: 'image',
            }],
          },
          method: 'PATCH',
          name: 'event-1d',
          url: 'images/1',
        });

        const event2 = await event.saveRelationship('image') as Record;
        expect(event2.id).to.equal(12345);
        expect(event2.type).to.equal('event');
        expect(event2['imageId'][0]).to.equal('1');
        expect(event['imageId'][0]).to.equal('1');
        expect(event).to.equal(event2);

      });
    });

    describe('removing record', () => {
      it('should remove a record', async () => {
        mockApi({
          name: 'event-1',
          url: 'event/12345',
        });

        const store = new Store();
        const events = await store.fetch('event', 12345);

        const record = events.data as Record;

        mockApi({
          method: 'DELETE',
          name: 'event-1',
          url: 'event/12345',
        });

        expect(store.findAll('event').length).to.equal(1);
        const updated = await record.remove();
        expect(updated).to.equal(true);
        expect(store.findAll('event').length).to.equal(0);
      });

      it('should remove a record if not in store', async () => {
        mockApi({
          name: 'event-1',
          url: 'event/12345',
        });

        const store = new Store();
        const events = await store.fetch('event', 12345);

        const record = events.data as Record;

        expect(store.findAll('event').length).to.equal(1);
        store.remove(record.type, record.id);
        expect(store.findAll('event').length).to.equal(0);

        mockApi({
          method: 'DELETE',
          name: 'event-1',
          url: 'event/12345',
        });

        const updated = await record.remove();
        expect(updated).to.equal(true);
        expect(store.findAll('event').length).to.equal(0);
      });

      it('should remove a local record without api calls', async () => {
        const store = new Store();
        const record = new Record({
          title: 'Example title',
          type: 'event',
        });
        store.add(record);

        expect(record['title']).to.equal('Example title');

        expect(store.findAll('event').length).to.equal(1);
        const updated = await record.remove();
        expect(updated).to.equal(true);
        expect(store.findAll('event').length).to.equal(0);
      });

      it('should remove a record from the store', async () => {
        mockApi({
          name: 'event-1',
          url: 'event/12345',
        });

        const store = new Store();
        const events = await store.fetch('event', 12345);

        const record = events.data as Record;

        mockApi({
          method: 'DELETE',
          name: 'event-1',
          url: 'event/12345',
        });

        expect(store.findAll('event').length).to.equal(1);
        const updated = await store.destroy(record.type, record.id);
        expect(updated).to.equal(true);
        expect(store.findAll('event').length).to.equal(0);
      });

      it('should remove a local record from store without api calls', async () => {
        const store = new Store();
        const record = new Record({
          title: 'Example title',
          type: 'event',
        });
        store.add(record);

        expect(record['title']).to.equal('Example title');

        expect(store.findAll('event').length).to.equal(1);
        const updated = await store.destroy(record.type, record.id);
        expect(updated).to.equal(true);
        expect(store.findAll('event').length).to.equal(0);
      });

      it('should silently remove an unexisting record', async () => {
        const store = new Store();

        expect(store.findAll('event').length).to.equal(0);
        const updated = await store.destroy('event', 1);
        expect(updated).to.equal(true);
        expect(store.findAll('event').length).to.equal(0);
      });
    });
  });

  describe('error handling', () => {
    it('should handle network failure', async () => {
      const store = new Store();

      mockApi({
        name: 'events-1',
        status: 404,
        url: 'event',
      });

      const fetch = store.fetchAll('event');

      return fetch.then(
        () => expect(true).to.equal(false),
        (err) => {
          expect(err).to.be.an('object');
          expect(err.status).to.equal(404);
          expect(err.message).to.equal('Invalid HTTP status: 404');
        },
      );
    });

    it('should handle invalid responses', async () => {
      const store = new Store();

      mockApi({
        name: 'invalid',
        url: 'event',
      });

      const fetch = store.fetchAll('event');

      return fetch.then(
        () => expect(true).to.equal(false),
        (err) => expect(err).to.have.all.keys(['name', 'message', 'type']),
      );
    });

    it('should handle api error', async () => {
      const store = new Store();

      mockApi({
        name: 'error',
        url: 'event',
      });

      const fetch = store.fetchAll('event');

      return fetch.then(
        () => expect(true).to.equal(false),
        (err) => expect(err[0]).to.be.an('object'),
      );
    });

    it('should handle api error on save', async () => {
      const store = new Store();

      const record = new Record({
        title: 'Test',
        type: 'event',
      });
      store.add(record);

      mockApi({
        method: 'POST',
        name: 'error',
        url: 'event',
      });

      const fetch = record.save();

      return fetch.then(
        () => expect(true).to.equal(false),
        (err) => expect(err[0]).to.be.an('object'),
      );
    });

    it('should handle api error on remove', async () => {
      const store = new Store();

      mockApi({
        name: 'events-1',
        url: 'event',
      });

      const response = await store.fetchAll('event');

      mockApi({
        method: 'DELETE',
        name: 'error',
        url: 'event/1',
      });

      const fetch = response.data[0].remove();

      return fetch.then(
        () => expect(true).to.equal(false),
        (err) => expect(err[0]).to.be.an('object'),
      );
    });
  });

  describe('headers', () => {
    beforeEach(() => {
      config.defaultHeaders = {
        'X-Auth': '12345',
        'content-type': 'application/vnd.api+json',
      };
    });

    it ('should send the default headers', async () => {
      mockApi({
        name: 'events-1',
        reqheaders: {
          'X-Auth': '12345',
        },
        url: 'event',
      });

      const store = new Store();
      const events = await store.fetchAll('event');

      expect(events.data).to.be.an('array');
    });

    it ('should send custom headers', async () => {
      mockApi({
        name: 'events-1',
        reqheaders: {
          'X-Auth': '54321',
        },
        url: 'event',
      });

      const store = new Store();
      const events = await store.fetchAll('event', false, {
        headers: {
          'X-Auth': '54321',
        },
      });

      expect(events.data).to.be.an('array');
    });

    it ('should receive headers', async () => {
      mockApi({
        headers: {
          'X-Auth': '98765',
        },
        name: 'events-1',
        url: 'event',
      });

      const store = new Store();
      const events = await store.fetchAll('event');

      expect(events.data).to.be.an('array');
      expect(events.headers.get('X-Auth')).to.equal('98765');
    });
  });

  describe('params', () => {
    it('should support basic filtering', async () => {
      mockApi({
        name: 'events-1',
        query: (q) => expect(q).to.eql({filter: {name: 'foo'}}),
        url: 'event',
      });

      const store = new Store();
      const events = await store.fetchAll('event', false, {filter: {name: 'foo'}});

      expect(events.data).to.be.an('array');
      expect(events.data['length']).to.equal(4);
    });

    it('should support advanced filtering', async () => {
      mockApi({
        name: 'events-1',
        query: (q) => expect(q).to.eql({filter: {'bar.id': '2', 'name': 'foo'}}),
        url: 'event',
      });

      const store = new Store();
      const events = await store.fetchAll('event', false, {filter: {name: 'foo', bar: {id: 2}}});

      expect(events.data).to.be.an('array');
      expect(events.data['length']).to.equal(4);
    });

    it('should support sorting', async () => {
      mockApi({
        name: 'events-1',
        query: (q) => expect(q).to.eql({sort: 'name'}),
        url: 'event',
      });

      const store = new Store();
      const events = await store.fetchAll('event', false, {sort: 'name'});

      expect(events.data).to.be.an('array');
      expect(events.data['length']).to.equal(4);
    });

    it('should support advanced sorting', async () => {
      mockApi({
        name: 'events-1',
        query: (q) => expect(q).to.eql({sort: '-name,bar.id'}),
        url: 'event',
      });

      const store = new Store();
      const events = await store.fetchAll('event', false, {sort: ['-name', 'bar.id']});

      expect(events.data).to.be.an('array');
      expect(events.data['length']).to.equal(4);
    });

    it('should support inclusion of related resources', async () => {
      mockApi({
        name: 'events-1',
        query: (q) => expect(q).to.eql({include: 'bar'}),
        url: 'event',
      });

      const store = new Store();
      const events = await store.fetchAll('event', false, {include: 'bar'});

      expect(events.data).to.be.an('array');
      expect(events.data['length']).to.equal(4);
    });

    it('should support advanced inclusion of related resources', async () => {
      mockApi({
        name: 'events-1',
        query: (q) => expect(q).to.eql({include: 'bar,bar.baz'}),
        url: 'event',
      });

      const store = new Store();
      const events = await store.fetchAll('event', false, {include: ['bar', 'bar.baz']});

      expect(events.data).to.be.an('array');
      expect(events.data['length']).to.equal(4);
    });

    it('should support sparse fields', async () => {
      mockApi({
        name: 'events-1',
        query: (q) => expect(q).to.eql({fields: {foo: 'name', bar: 'name'}}),
        url: 'event',
      });

      const store = new Store();
      const events = await store.fetchAll('event', false, {fields: {foo: 'name', bar: 'name'}});

      expect(events.data).to.be.an('array');
      expect(events.data['length']).to.equal(4);
    });

    it('should support advanced sparse fields', async () => {
      mockApi({
        name: 'events-1',
        query: (q) => expect(q).to.eql({fields: {'foo': 'name', 'bar': 'name', 'bar.baz': 'foo,bar'}}),
        url: 'event',
      });

      const store = new Store();
      const events = await store.fetchAll('event', false, {fields: {
        'bar': 'name',
        'bar.baz': ['foo', 'bar'],
        'foo': 'name',
      }});

      expect(events.data).to.be.an('array');
      expect(events.data['length']).to.equal(4);
    });
  });
});
