# Moving from homebridge-smartthings-oauth

Do this only after the Local accessories have worked reliably for you.

Apple Home treats the Local accessories as new devices. **Automations, scenes, rooms and favourites of the old accessories do not move automatically**, and no tool in this plugin claims to move them.

| Step | What to do |
|---|---|
| 1 | Keep both plugins running. Confirm each Local accessory does everything you use |
| 2 | In the Home app, put each Local accessory in the same room as the old one |
| 3 | Edit every automation and scene: add the Local accessory, remove the old one. The Home app has no bulk replace |
| 4 | The "Local" suffix is fixed. Rename the accessory in the Home app if you want |
| 5 | In the old plugin, add the migrated appliance to its ignore list (or remove the plugin if nothing else uses it) |
| 6 | Keep TVs, washers and anything this plugin does not expose on the old plugin |

This plugin never changes or deletes the old plugin's configuration, tokens, cache or pairing. The only thing it reads is the list of accessory names in Homebridge's accessory cache, read-only, to suggest names on the settings page.

---

# الانتقال من homebridge-smartthings-oauth

نفّذ هذه الخطوات بعد أن تعمل أجهزة Local عندك بثبات.

يعامل تطبيق Home أجهزة Local كأجهزة جديدة. **تبقى الأتمتة والمشاهد والغرف والمفضلة مرتبطة بالأجهزة القديمة، ويلزم نقلها يدويًا**؛ هذه الإضافة لا تنقلها تلقائيًا.

| الخطوة | المطلوب |
|---|---|
| 1 | أبقِ الإضافتين تعملان معًا، وتأكد أن كل جهاز Local يؤدي كل ما تستخدمه |
| 2 | ضع كل جهاز Local في غرفة الجهاز القديم نفسها داخل تطبيق Home |
| 3 | عدّل كل أتمتة ومشهد: أضف جهاز Local ثم احذف القديم. تطبيق Home لا يوفر استبدالًا جماعيًا |
| 4 | اللاحقة Local ثابتة؛ غيّر اسم الجهاز من تطبيق Home إن أردت |
| 5 | في الإضافة القديمة أضف الجهاز المنقول إلى قائمة التجاهل، أو احذف الإضافة إذا لم يبق لها استخدام |
| 6 | أبقِ التلفزيونات والغسالة وكل ما لم تدعمه هذه الإضافة على الإضافة القديمة |

تبقى إعدادات الإضافة القديمة ورموزها وملفاتها واقترانها دون أي تعديل أو حذف. الشيء الوحيد الذي تقرؤه هذه الإضافة هو أسماء الأجهزة من ملف كاش Homebridge، للقراءة فقط، لاقتراح الأسماء في صفحة الإعدادات.
