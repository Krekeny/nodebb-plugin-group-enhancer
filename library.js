'use strict';

const db     = require.main.require('./src/database');
const Groups = require.main.require('./src/groups');

const FIELDS = ['extraDesc', 'logo', 'url', 'address'];  // db keys

const plugin = {};

/* 1. add routes for static assets (JS/CSS) */
plugin.init = async ({ router, middleware }) => {
    router.get('/admin/plugins/group-extras', middleware.admin.buildHeader,
        (req, res) => res.render('admin/plugins/group-extras'));
};

/* 2. during group-create and group-update keep only allowed props */
plugin.whitelist = async (hookData) => {
    const incoming = hookData.data || hookData.values;
    FIELDS.forEach(f => {
        if (incoming?.[f] !== undefined) {
            hookData.data  && (hookData.data[f]  = incoming[f]);
            hookData.values && (hookData.values[f] = incoming[f]);
        }
    });
    return hookData;
};

/* 3. when groups are fetched, append extras so the client can render them */
plugin.attachExtras = async (groups) => {
    await Promise.all(groups.map(async (g) => {
        const extras = await db.getObjectFields(`group:${g.name}`, FIELDS);
        Object.assign(g, extras);
    }));
    return groups;
};

module.exports = plugin;
