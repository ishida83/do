import { assert } from 'chai';
import _ from 'lodash';
import shortid from 'shortid';
import { recreateTables } from '../helpers';
import db from 'server/db';
import Card from 'server/models/Card';

const boardId = shortid.generate();
const listId = shortid.generate();
const commentId = shortid.generate();
const comment2Id = shortid.generate();
const cardId = shortid.generate();
const card2Id = shortid.generate();
const userId = shortid.generate();

describe('Card', () => {
    beforeEach(() => recreateTables().then(setup));

    describe('create', () => {
        const cardData = {
            text: 'test card'
        };

        it('should create card', () => {
            return Card.create(userId, listId, cardData).then(card => {
                const link = '/boards/' + boardId + '/cards/' + card.id;

                assert.property(card, 'id');
                assert.property(card.activity, 'created_at');
                delete card.activity.created_at;
                assert.deepEqual(_.omit(card, ['id']), {
                    text: cardData.text,
                    board_id: boardId,
                    link, 
                    activity: {
                        id: 1,
                        action: 'Created',
                        type: 'card',
                        entry: {
                            title: cardData.text,
                            link
                        }
                    }
                });
            });
        });

        it('should generate shortid', () => {
            return Card.create(userId, listId, cardData).then(card => {
                assert.isTrue(shortid.isValid(card.id));
            });
        });

        it('should relate card to list', () => {
            return Card.create(userId, listId, cardData).then(card => {
                return db.one(`SELECT list_id FROM lists_cards WHERE card_id = $1`, [card.id]);
            }).then(result => {
                assert.equal(result.list_id, listId);
            });
        });
    });

    describe('update', () => {
        it('should update card and return updated card with id, activity and updated fields', () => {
            return Card.update(userId, cardId, { text: 'updated text' })
                .then(card => {
                    const text = 'updated text';

                    assert.property(card.activity, 'created_at');
                    delete card.activity.created_at;
                    assert.deepEqual(card, {
                        id: cardId,
                        text,
                        activity: {
                            id: 1,
                            action: 'Updated',
                            type: 'card',
                            entry: {
                                title: text,
                                link: '/boards/' + boardId + '/cards/' + cardId
                            }
                        }
                    });
                });
        });
    });

    describe('drop', () => {
        it('should drop card entry', () => {
            return Card.drop(cardId)
                .then(() => {
                    return db.query(`SELECT id FROM cards WHERE id = $1`, [cardId]);
                })
                .then(result => {
                    assert.lengthOf(result, 0);
                });
        });

        it('should return dropped card id and board id which card belongs', () => {
            return Card.drop(cardId)
                .then(result => {
                    assert.equal(result.id, cardId);
                    assert.deepEqual(result, {
                        id: cardId,
                        board_id: boardId
                    });
                });
        });
    });

    describe('findById', () => {
        it('should return card with all relations', () => {
            return Card.findById(card2Id)
                .then(card => {
                    assert.property(card.comments[0], 'created_at');
                    assert.property(card.comments[1], 'created_at');
                    assert.property(card.comments[0].user, 'avatar');
                    assert.property(card.comments[1].user, 'avatar');

                    const _card = _.assign({}, card, {
                        comments: card.comments.map(comment => _.omit(_.assign({}, comment, {
                            user: _.omit(comment.user, ['avatar'])
                        }), ['created_at']))
                    });

                    assert.deepEqual(_card, {
                        id: card2Id,
                        text: 'test card 2',
                        link: '/boards/' + boardId + '/cards/' + card2Id,
                        board_id: boardId,
                        comments: [{
                            id: commentId,
                            text: 'test comment 1',
                            user: {
                                id: userId,
                                username: 'testuser'
                            }
                        }, {
                            id: comment2Id,
                            text: 'test comment 2',
                            user: {
                                id: userId,
                                username: 'testuser'
                            }
                        }]
                    });
                });
        });
    });

    describe('archive', () => {
        it('should set `archive` flag to true', () => {
            return Card.archive(cardId)
                .then(() => {
                    return db.one(`SELECT archived FROM cards WHERE id = $1`, [cardId]);
                })
                .then(result => {
                    assert.isTrue(result.archived);
                });
        });

        it('should return archived entry id', () => {
            return Card.archive(cardId)
                .then(result => {
                    assert.deepEqual(result, {
                        id: cardId
                    });
                });
        });
    });
});

function setup() {
    return db.none(`
        INSERT INTO users (id, username, email, hash, salt)
            VALUES ($1, 'testuser', 'testuser@test.com', 'hash', 'salt');
        INSERT INTO boards (id, title) VALUES ($6, 'test board');
        INSERT INTO lists (id, title) VALUES ($7, 'test list');
        INSERT INTO boards_lists VALUES ($6, $7);
        INSERT INTO cards (id, text) VALUES ($2, 'test card 1');
        INSERT INTO cards (id, text) VALUES ($3, 'test card 2');
        INSERT INTO lists_cards VALUES ($7, $2);
        INSERT INTO lists_cards VALUES ($7, $3);
        INSERT INTO comments (id, text) VALUES ($4, 'test comment 1');
        INSERT INTO comments (id, text) VALUES ($5, 'test comment 2');
        INSERT INTO cards_comments VALUES ($3, $4);
        INSERT INTO cards_comments VALUES ($3, $5);
        INSERT INTO users_comments VALUES ($1, $4);
        INSERT INTO users_comments VALUES ($1, $5);
    `, [userId, cardId, card2Id, commentId, comment2Id, boardId, listId]);
};
