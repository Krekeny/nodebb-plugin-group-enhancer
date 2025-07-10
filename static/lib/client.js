'use strict';

/* Runs every time /groups/:slug/edit is Ajaxified in */
$(window).on('action:ajaxify.end', async (evt, data) => {
    if (!data || data.template.name !== 'groups/edit') { return; }

    const $form = $('.group-settings-form');
    if (!$form.length || $('#change-group-url').length) { return; }  // injected already

    /* ---------- 1.  Add fields to the DOM ---------- */
    const html = `
        <!-- extra description (long text) -->
        <div class="mb-3">
            <label class="form-label" for="change-group-extradesc">Long Description</label>
            <textarea class="form-control" id="change-group-extradesc"
                      rows="4" maxlength="2048"
                      placeholder="Detailed description…"></textarea>
        </div>

        <!-- logo uploader OR url -->
        <div class="mb-3">
            <label class="form-label" for="change-group-logo">Logo image URL</label>
            <input type="text" class="form-control" id="change-group-logo"
                   placeholder="https://example.com/logo.png">
        </div>

        <!-- external website -->
        <div class="mb-3">
            <label class="form-label" for="change-group-url">Website</label>
            <input type="url" class="form-control" id="change-group-url"
                   placeholder="https://example.com">
        </div>

        <!-- address -->
        <div class="mb-3">
            <label class="form-label" for="change-group-address">Address</label>
            <input type="text" class="form-control" id="change-group-address"
                   placeholder="Street, City, Country">
        </div>
    `;
    /* insert right after the short description block you pasted */
    $('#change-group-desc').closest('.mb-3').after(html);

    /* pre-fill with existing values (ajaxify.data comes from filter:groups.get) */
    const g = data.group;
    $('#change-group-extradesc').val(g.extraDesc || '');
    $('#change-group-logo').val(g.logo || '');
    $('#change-group-url').val(g.url || '');
    $('#change-group-address').val(g.address || '');

    /* ---------- 2.  Patch the SAVE button ---------- */
    $(document).off('click.groupExtras')          // avoid duplicate binding
        .on('click.groupExtras', '[component="groups/save"]', async function () {
            const slug = ajaxify.data.slug;
            const payload = {
                // existing NodeBB fields are already serialised by core JS;
                // we only have to tack on our extras:
                extraDesc : $('#change-group-extradesc').val().trim(),
                logo      : $('#change-group-logo').val().trim(),
                url       : $('#change-group-url').val().trim(),
                address   : $('#change-group-address').val().trim(),
            };

            try {
                await app.put(`/api/v3/groups/${slug}`, payload);
                app.alertSuccess('Saved!');
            } catch (err) {
                app.alertError(err.message || err);
            }
        });
});
