const _ = require('lodash');
const shortid = require('shortid');
const pgp = require('pg-promise');
const db = require('../db');
const Activity = require('./Activity');

const List = {
    create(userId, boardId, listData) {
        const listId = shortid.generate();

        return db.one(`
            INSERT INTO lists (id, title) VALUES ($1, $2)
            RETURNING id
        `, [listId, listData.title])
            .then(list => {
                return db.one(`
                    INSERT INTO boards_lists VALUES ($1, $2);
                    SELECT id, title, link FROM lists WHERE id = $2
                `, [boardId, listId]);
            })
            .then(list => {
                return Activity.create(userId, listId, 'lists', 'Created')
                    .then(activity => {
                        return _.assign({}, list, { activity });
                    });
            });
    },

    update(userId, listId, data) {
        const _data = _.pick(data, ['title']);

        if (_.isEmpty(_data)) return;

        const props = _.keys(_data).map(k => pgp.as.name(k)).join();
        const values = _.values(_data);

        return db.one(`
            UPDATE lists SET ($2^) = ($3:csv) WHERE id = $1 RETURNING id, $2^
        `, [listId, props, values])
            .then(list => {
                return Activity.create(userId, listId, 'lists', 'Updated')
                    .then(activity => {
                        return _.assign({}, list, { activity });
                    });
            });
    },

    drop(id) {
        return db.one(`DELETE FROM lists WHERE id = $1 RETURNING id`, [id]);
    },

    archive(listId) {
        return db.one(`
            UPDATE lists SET (archived) = (true) WHERE id = $1 RETURNING id
        `, [listId]);
    }
};

module.exports = List;
