import 'babel-polyfill'; // only needed when you dont have polyfills
import RxDB from 'rxdb';
import * as geolib from 'geolib';

RxDB.plugin(require('pouchdb-adapter-idb'));
RxDB.plugin(require('pouchdb-adapter-http')); //enable syncing over http

const collections = [{
    name: 'localuser',
    schema: require('./UserSchema.js').default,
    methods: {}
  },
  {
    name: 'users',
    schema: require('./UserSchema.js').default,
    methods: {
      getDistance: function(localuser) {
        return geolib.getDistance(localuser.position, this.position);
      }
    },
    sync: true
  },
  {
    name: 'messages',
    schema: require('./MessageSchema.js').default,
    methods: {},
    sync: true
  }
];


const syncURL = 'http://' + window.location.hostname + ':10101/';
// const syncURL = host;

/* because vue-dev-server only reloads the changed code and not the whole page,
 * we have to ensure that the same database only exists once
 * we can either set ignoreDuplicate to true
 * or remove the previous instance which we do here
 */
window.dbs = window.dbs || [];
const clearPrev = async function() {
  await Promise.all(
    window.dbs
    .map(db => db.destroy())
  );
};

let dbPromise = null;

const _create = async function() {
  console.log('DatabaseService: creating database..');
  await clearPrev();
  const db = await RxDB.create({
    name: 'localuserdb',
    adapter: 'idb',
    queryChangeDetection: true,
    password: 'myLongAndStupidPassword'
  });
  window.dbs.push(db);
  console.log('DatabaseService: created database');
  window['rxdb'] = db; // write to window for debugging

  // show leadership in title
  db.waitForLeadership().then(() => {
    console.log('isLeader now');
    document.title = '♛ ' + document.title;
  });

  // create collections
  console.log('DatabaseService: create collections');
  await Promise.all(collections.map(colData => db.collection(colData)));


  // hook
  db.localuser.postInsert(async(plainData) => {
    console.log('upsert hook');
    const all = await db.users.find().exec();
    console.dir(all);
    // const doc = await db.users.upsert(plainData);
    // console.dir(doc);
    return;
  }, true);

  /*
  db.localuser.postSave(plainData => {
  console.log('upsert hook');
  return db.users.upsert(plainData);
}, true);

   */

  // sync

  console.log('DatabaseService: sync');
  db.users.sync({
    remote: syncURL + 'users/'
  });


  return db;
};

let DB = null;

export async function init() {
  if (!dbPromise)
    dbPromise = _create();
  DB = await dbPromise;
  return DB;
}

export function get() {
  if (!DB) throw new Error('Database.init() not done yet');
  return DB;
}
