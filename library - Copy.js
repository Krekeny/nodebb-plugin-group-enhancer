'use strict';

const db = require.main.require('./src/database');
const Groups = require.main.require('./src/groups');

const Plugin = {};

// ❶ Whitelist the new keys so /api/v3/groups PUT will accept them
Plugin.extendWhitelist = async ({ fields }) => {
  ['extraDesc', 'logo', 'url', 'address'].forEach(f => {
    if (!fields.includes(f)) fields.push(f);
  });
  return { fields };
};

// ❷ Merge extras back whenever a group is fetched
// Plugin.addExtras = async (data) => {
// 	console.log('[Group-Enhancer] addExtras called for', data?.group?.slug);

//   if (!data?.group?.slug) return data;

//   const slug = data.group.slug;
//   let extras = {};
//   try {
//     extras = await db.getObject(`plugin:group-enhancer:${slug}`) || {};
//   } catch (err) {
//     console.error('[Group-Enhancer] Error fetching extra group data:', err);
//   }

//   data.group = { ...data.group, ...extras };
//   return data;
// };

Plugin.init = function (params, callback) {
  const { router, middleware } = params;

  const adminGuard = middleware.checkPrivileges
    ? middleware.checkPrivileges('admin:groups')
    : (req, res, next) => next();

  router.put(
    '/api/v3/plugins/group-enhancer/groups/:slug',
    middleware.applyCSRF,
    adminGuard,
    async (req, res) => {
      console.log('[Group-Enhancer] PUT request received for slug:', req.params.slug);

      try {
        const slug = req.params.slug;
        const allGroups = await Groups.getGroupsFromSet('groups:createtime', 0, -1);
        const group = allGroups.find(g => g.slug === slug);

        if (!group) {
          return res.status(404).json({ error: 'group-not-found' });
        }

        const {
          extraDesc = '',
          logo = '',
          url = '',
          address = '',
        } = req.body || {};

        await db.setObject(`plugin:group-enhancer:${slug}`, {
          extraDesc,
          logo,
          url,
          address,
        });

        return res.json({ success: true });
      } catch (err) {
        console.error('[Group-Enhancer] Route error:', err);
        return res.status(500).json({ error: err.message || 'Unknown error' });
      }
    }
  );

  console.log('[Group-Enhancer] Route PUT registered');

  if (callback) callback();
};

module.exports = {
  ...Plugin,

  // explicitly wire these for the hooks in plugin.json
  addExtrasToOne: Plugin.addExtras,
  addExtrasToMany: async (data) => {
    if (!Array.isArray(data.groups)) return data;
    const groupsWithExtras = await Promise.all(
      data.groups.map(async (group) => {
        const extras = await db.getObject(`plugin:group-enhancer:${group.slug}`) || {};
        return { ...group, ...extras };
      })
    );
    data.groups = groupsWithExtras;
    return data;
  },

  onGroupUpdate: async (data) => data, // placeholder if needed for compatibility
};
