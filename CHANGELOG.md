# Changelog

Versions follow [Semantic Versioning](https://semver.org/). Releases are published under the npm tag `latest`; pre-releases under `beta`.

## 1.0.16

- Settings page: the connection engine is now the first step, at the top. A new installation chooses it knowingly before anything else; an installation that already has appliances keeps the engine it runs on.

**بالعربية**

- صفحة الإعدادات: صار محرك الاتصال الخطوة الأولى في أعلى الصفحة. التثبيت الجديد يختاره عن علم قبل أي شيء آخر، والتثبيت الذي فيه أجهزة يبقى على محركه الحالي.

## 1.0.15

- Laundry appliances now have their own options, like air conditioners: show or hide the cycle tile, the "Finished" sensor, and the power and energy readings. Open the appliance with Configuration, tick what you want, press Update. A part that is switched off is removed from Apple Home; the energy readings move to the part that stays.
- The cycle tile now also reports the cycle's length, which the Home app needs before it shows the time remaining on a valve tile.
- The washer accessory is confirmed on a real washer (`DA_WM_TP1_21_COMMON`): running state, wash stage and time remaining.

**بالعربية**

- صار لأجهزة الغسيل خياراتها مثل المكيفات: أظهر أو أخفِ بطاقة الدورة، وحساس «Finished»، وقراءات القدرة والطاقة. افتح الجهاز من «Configuration»، وحدّد ما تريد، ثم اضغط «Update». الجزء الذي تُطفئه يُزال من Apple Home، وتنتقل قراءات الطاقة إلى الجزء الباقي.
- صارت بطاقة الدورة تعلن مدة الدورة أيضًا، وهذا ما يحتاجه تطبيق Home ليعرض الوقت المتبقي على بطاقة الصمام.
- تأكد ملحق الغسالة على غسالة حقيقية (`DA_WM_TP1_21_COMMON`): حالة التشغيل ومرحلة الغسيل والوقت المتبقي.

## 1.0.14

- Samsung TVs (Tizen, 2016 and later) can now be added. Enter the TV's address and press Test & discover: the page recognises a TV and shows the steps. Stand in front of the TV, press "Pair with the TV" and choose "Allow" on its screen. This is done once; the pairing is kept in the plugin's own folder.
- Choose how the TV appears in Apple Home: a TV tile with the Control Centre remote and input buttons (Apple requires each TV tile to be added to the Home app on its own, with the bridge's PIN), or switches inside the bridge (power, mute, volume up, volume down) that appear by themselves.
- Switching a TV on from fully off uses wake-on-network.
- A TV needs no Python runtime.
- New, optional: a JavaScript connection engine that needs no Python at all. It gives the same features and uses the same certificate, so appliances see no difference. Choose it under General → Connection engine and restart the bridge; switch back the same way. It is a beta: tested against a simulated appliance over real encryption, awaiting reports from real appliances. Its transport code comes from homebridge-samsung-ocf by aziz66 (MIT).

**بالعربية**

- صار بالإمكان إضافة تلفزيونات Samsung (نظام Tizen، من 2016 فأحدث). أدخل عنوان التلفزيون واضغط «اختبار واكتشاف»: تتعرّف الصفحة على التلفزيون وتعرض الخطوات. قف أمام التلفزيون، واضغط «اقتران مع التلفزيون»، ثم اختر «سماح» على شاشته. يتم ذلك مرة واحدة، ويُحفظ الاقتران في مجلد الإضافة.
- اختر شكل ظهور التلفزيون في Apple Home: بطاقة تلفزيون مع ريموت مركز التحكم وأزرار المداخل (تشترط Apple إضافة كل بطاقة تلفزيون بمفردها في تطبيق Home برمز الجسر)، أو مفاتيح داخل الجسر (تشغيل، كتم، رفع الصوت، خفض الصوت) تظهر تلقائيًا.
- تشغيل التلفزيون من الإطفاء الكامل يعتمد على الإيقاظ عبر الشبكة.
- التلفزيون لا يحتاج بيئة Python.
- جديد واختياري: محرك اتصال بلغة JavaScript لا يحتاج Python إطلاقًا. يقدّم المزايا نفسها ويستخدم الشهادة نفسها، فلا يتغير شيء من جهة الأجهزة. اختره من «عام ← محرك الاتصال» ثم أعد تشغيل الجسر، وارجع بالطريقة نفسها. هو تجريبي: اختُبر على جهاز محاكى بتشفير حقيقي، وننتظر نتائج الأجهزة الحقيقية. كود النقل فيه مأخوذ من homebridge-samsung-ocf لصاحبه aziz66 (رخصة MIT).

## 1.0.13

- Washers, dryers and dishwashers now get a HomeKit accessory for following the cycle: a tile that shows the cycle running with the time remaining, a "Finished" sensor that turns on for ten minutes when the cycle ends (use it for a notification or an automation), and power and energy readings in Eve. Nothing is sent to the appliance; the cycle is started at the appliance itself.
- Add the appliance the same way as an air conditioner: enter its address, press Test & discover, give it a name, press Add.
- Diagnostics file: the machine state of laundry appliances is no longer hidden by mistake.
- If the Python runtime cannot start when Homebridge boots (for example no internet for the first download), the plugin now tries again on its own, at growing intervals, without a restart.
- Readings are saved to disk far less often: Apple Home is still updated at once, changed readings are saved within seconds, unchanged ones once a minute. This is kinder to a Raspberry Pi memory card.

**بالعربية**

- صار للغسالات والمجففات وغسالات الصحون ملحق في HomeKit لمتابعة الدورة: بطاقة تبيّن أن الدورة تعمل مع الوقت المتبقي، وحساس «Finished» يتفعّل عشر دقائق عند انتهاء الدورة (استخدمه لإشعار أو أتمتة)، وقراءات القدرة والطاقة في Eve. لا تُرسل الإضافة أي أمر إلى الجهاز، وتبدأ الدورة من الجهاز نفسه.
- أضف الجهاز بالطريقة نفسها كالمكيف: أدخل عنوانه، اضغط «اختبار واكتشاف»، سمِّه، ثم اضغط «إضافة».
- ملف التشخيص: لم تعد حالة الآلة في أجهزة الغسيل تُحجب بالخطأ.
- إذا تعذّر تشغيل بيئة Python عند إقلاع Homebridge (مثل انقطاع الإنترنت عند أول تنزيل)، تعيد الإضافة المحاولة تلقائيًا بفواصل متزايدة دون إعادة تشغيل.
- قلّ حفظ القراءات على القرص كثيرًا: يتحدث Apple Home فورًا كما كان، وتُحفظ القراءات المتغيرة خلال ثوانٍ، وغير المتغيرة مرة كل دقيقة. هذا أرفق ببطاقة ذاكرة Raspberry Pi.

## 1.0.12

- Apple Home gets its answer within about a second even when an appliance acknowledges a command late. The command keeps going in the background; if it fails, the tile returns to the real state. This removes the Homebridge "slow to respond" warning.
- The Python runtime repairs itself when its files are incomplete, for example after restoring a Homebridge backup (backups skip files larger than 10 MB).
- Settings page: the option is now called "Light Display", matching its name in Apple Home, and the note under the options says the plugin is tested on real air conditioners and that features differ by model.

**بالعربية**

- يصل الرد إلى Apple Home خلال ثانية تقريبًا حتى لو تأخر الجهاز في تأكيد الأمر. يستمر الأمر في الخلفية، وإذا فشل تعود البطاقة إلى الحالة الحقيقية. بذلك يختفي تحذير Homebridge عن بطء الاستجابة.
- تُصلح بيئة Python نفسها إذا كانت ملفاتها ناقصة، كما يحدث بعد استرجاع نسخة احتياطية من Homebridge (النسخ الاحتياطي يتخطى الملفات الأكبر من 10 ميجابايت).
- صفحة الإعدادات: صار اسم الخيار «Light Display» مطابقًا لاسمه في Apple Home، والملاحظة تحت الخيارات توضّح أن الإضافة مجرَّبة على مكيفات حقيقية وأن المزايا تختلف حسب الطراز.

## 1.0.11 — 2026-11-22

### Added
- **The plugin follows an appliance whose IP address changed.** Each appliance is known by the device id it reports; the address is only where it was last seen. When an appliance stops answering at its address for about a minute, the plugin looks for it on the local network (by MAC address first, then by device id), confirms the device id over the authenticated session, and carries on at the new address. The address is remembered across restarts; the settings need no edit. A new router or new DHCP settings no longer strand the appliance.
- **Add an appliance by IP address or by MAC address.** The plugin works out the other one and stores both.

Limits: the search covers the local network only (the /24 around the last address and around the Homebridge machine). Tested in simulation only; not yet confirmed on real appliances.

### بالعربية
- **الإضافة تتبع الجهاز إذا تغيّر عنوانه.** كل جهاز يُعرَّف بالمعرّف الذي يعلنه، والعنوان مجرد آخر مكان شوهد فيه. إذا توقف الجهاز عن الرد على عنوانه نحو دقيقة، تبحث عنه الإضافة في الشبكة المحلية (بعنوان MAC أولًا ثم بالمعرّف)، وتتأكد من المعرّف عبر الجلسة الموثقة، وتكمل على العنوان الجديد. يُحفظ العنوان عبر إعادة التشغيل دون تعديل الإعدادات، فتغيير الراوتر أو إعدادات DHCP لا يقطع الجهاز.
- **إضافة الجهاز بعنوان IP أو بعنوان MAC.** الإضافة تستخرج الآخر وتحفظ الاثنين.
- حدود: البحث يغطي الشبكة المحلية فقط. اختُبر بالمحاكاة ولم يتأكد على الأجهزة الفعلية بعد.

## 1.0.10 — 2026-11-22

### Changed
- A poll that times out is now retried on the same session (up to two more times) instead of dropping the session at the first lost answer.
- After a working session drops, the plugin reconnects silently for up to 30 seconds. The appliance is shown as "not reachable" only if it is still gone after that.

Why: logs from five air conditioners show short drops roughly every five minutes, often on several units in the same second, each recovering within seconds. The trigger is outside the plugin and not yet identified. These changes keep such drops from reaching HomeKit; they do not remove the trigger. Tested in simulation only.

### بالعربية
- القراءة التي تنتهي مهلتها تُعاد على الجلسة نفسها (حتى مرتين إضافيتين) بدل إسقاط الجلسة عند أول رد مفقود.
- بعد سقوط جلسة عاملة تعيد الإضافة الاتصال بصمت حتى 30 ثانية، ويظهر الجهاز «غير متاح» إن بقي منقطعًا بعدها.

السبب: سجلات خمسة مكيفات تُظهر انقطاعات قصيرة كل خمس دقائق تقريبًا، وغالبًا على عدة أجهزة في الثانية نفسها، ويعود كل منها خلال ثوانٍ. المسبب خارج الإضافة ولم يُحدَّد بعد. هذه التعديلات تمنع وصول هذه الانقطاعات إلى HomeKit ولا تزيل المسبب. اختُبرت بالمحاكاة فقط.

## 1.0.9 — 2026-11-22

### Fixed
- On phones, "Download diagnostics file" could do nothing, because the browser blocks a download started inside the settings frame. The diagnostics text is now also shown on the page with **Share file** and **Copy text** buttons.

### بالعربية
- على الجوال كان زر «تنزيل ملف التشخيص» قد لا يفعل شيئًا، لأن المتصفح يمنع تنزيلًا يبدأ من داخل إطار الإعدادات. يظهر نص التشخيص الآن في الصفحة مع زرّي **مشاركة الملف** و**نسخ النص**.

## 1.0.8 — 2026-11-22

### Changed
- Every part of an air conditioner is now named after its appliance: "Abdulaziz AC Fan", "Abdulaziz AC Fast", "Abdulaziz AC Humidity", and so on. Before, every unit had a tile simply called "Fan", so a Siri command could hit all of them at once.
- The display light is named "Light Display".
- Existing tiles take the new names on the next restart, except tiles you renamed in the Home app: those keep your name.

### Fixed
- On Python 3.12 and older, stopping an appliance connection raised an internal error inside the helper (a name clash with Python's own thread code). It could delay a clean shutdown or restart of the child bridge. Present since the first version; the automated tests did not cover it until now.

### Verification
- Changes asked for by the Homebridge verification checks: the `supports-hap` keyword, and `required` moved to object level in the settings schema.

### Security
- The Python packages are now installed with checksum verification: every downloaded file must match a SHA-256 recorded in the plugin, otherwise nothing is installed. A dependency that was not pinned before (`typing-extensions`, needed on Python older than 3.13) is pinned too. An environment that is already prepared is left as it is.

### بالعربية
- كل عنصر داخل المكيف يحمل اسم جهازه: «Abdulaziz AC Fan» و«Abdulaziz AC Fast» و«Abdulaziz AC Humidity» وهكذا. سابقًا كان لكل مكيف عنصر اسمه «Fan» فقط، فيصيب أمر Siri الجميع.
- ضوء الشاشة صار اسمه «Light Display».
- العناصر الحالية تأخذ الأسماء الجديدة عند إعادة التشغيل، وما غيّرت اسمه من تطبيق Home يبقى باسمك.
- على Python 3.12 وما قبله كان إيقاف اتصال الجهاز يسبب خطأ داخليًا في الكود المساعد (تعارض اسم مع كود Python نفسه)، وقد يؤخر الإيقاف أو إعادة التشغيل النظيفة للجسر الفرعي. الخلل موجود منذ أول إصدار ولم تكن الاختبارات الآلية تغطيه.
- حزم Python تُثبَّت الآن مع التحقق من البصمة: كل ملف منزَّل يجب أن يطابق بصمة SHA-256 مسجلة في الإضافة، وإلا لم يُثبَّت شيء. وثُبّت إصدار حزمة تابعة لم تكن مثبتة (`typing-extensions`، تلزم مع Python أقدم من 3.13). البيئة المجهزة مسبقًا تبقى كما هي.
- تعديلات طلبها فحص توثيق Homebridge: إضافة الكلمة المفتاحية `supports-hap`، ونقل `required` إلى مستوى الكائن في مخطط الإعدادات.

## 1.0.7 — 2026-11-22

### Added
- A **Getting started** checklist at the top of the settings page: four numbered steps, the one to do now highlighted, finished ones ticked. It folds away once setup is complete.

### بالعربية
- قائمة **خطوات البدء** أعلى صفحة الإعدادات: أربع خطوات مرقمة، تُبرز الخطوة المطلوبة الآن وتؤشّر على المنجزة، وتُطوى بعد اكتمال الإعداد.

## 1.0.6 — 2026-11-22

### Added
- A **Download diagnostics file** button in the discovery result, for any appliance that answers locally, including types that cannot be added yet (washers, for example). The file is what is needed to add support for a new type.

### بالعربية
- زر **تنزيل ملف التشخيص** في نتيجة الاكتشاف لأي جهاز يجيب محليًا، ومنها الأنواع التي لم تُدعم بعد (كالغسالات). هذا الملف هو المطلوب لإضافة دعم نوع جديد.

## 1.0.5 — 2026-11-22

### Fixed
- The display light is shown as off while the air conditioner is off. Before, a unit that was off but had its light setting on made the tile read "Powered On".

### بالعربية
- ضوء الشاشة يظهر مطفأً ما دام المكيف مطفأً. سابقًا كان المكيف المطفأ الذي إعداد ضوئه مفعّل يُظهر على البلاطة «Powered On».

## 1.0.4 — 2026-11-22

### Fixed
- Short connection drops no longer show the appliance as "not reachable". When a working session drops, the plugin reconnects once straight away; a command sent in that moment waits for the new session. The appliance is reported unreachable only if that reconnect fails as well.
- A name typed in the settings could be replaced by the model code when a second settings page was open (another tab or device) and saved its older copy. Every change now starts from the saved configuration.

Not yet confirmed on real appliances: both fixes passed simulated tests only. The cause of the drops themselves is still under investigation.

### بالعربية
- الانقطاعات القصيرة لم تعد تُظهر الجهاز «غير متاح». عند سقوط جلسة عاملة تعيد الإضافة الاتصال فورًا مرة واحدة، والأمر المرسل في تلك اللحظة ينتظر الجلسة الجديدة. يُعلن الجهاز غير متاح عند فشل إعادة الاتصال أيضًا.
- الاسم المكتوب في الإعدادات كان قد يُستبدل برمز الطراز إذا كانت صفحة إعدادات أخرى مفتوحة (تبويب أو جهاز آخر) وحفظت نسختها القديمة. كل تعديل يبدأ الآن من الإعدادات المحفوظة.

لم يتأكد الإصلاحان على الأجهزة الفعلية بعد: نجحا في اختبارات المحاكاة فقط، وسبب الانقطاعات نفسه ما زال قيد البحث.

## 1.0.3 — 2026-11-22

### Fixed
- A name you give a tile in the Home app is kept through plugin updates, restarts and later name changes in the settings. Only resetting the accessory brings the settings name back. In 1.0.2, removing the "Local" suffix replaced such a name once, on the first start after the update.

### بالعربية
- الاسم الذي تضعه للجهاز من تطبيق Home يبقى كما هو بعد تحديث الإضافة وإعادة تشغيلها وبعد تغيير الاسم في الإعدادات، ويعود اسم الإعدادات عند إعادة ضبط الملحق فقط. في 1.0.2 كانت إزالة اللاحقة Local تستبدل هذا الاسم مرة واحدة عند أول تشغيل بعد التحديث.

## 1.0.2 — 2026-11-22

### Changed
- Accessories are named exactly as typed in the settings. The automatic "Local" suffix is gone. Existing accessories take the new name on the next restart.

### Added
- A **Configuration** button on every configured appliance in the settings page. It opens the name and the "Shown in HomeKit" options directly, without running discovery again.

### بالعربية
- زر **الإعدادات** على كل جهاز في قائمة الأجهزة المضافة، يفتح الاسم وخيارات «ما يظهر في HomeKit» مباشرة دون إعادة الاكتشاف.
- يظهر اسم الجهاز كما تكتبه في الإعدادات تمامًا، وأُلغيت اللاحقة Local التلقائية. الأجهزة الحالية تأخذ الاسم الجديد عند إعادة التشغيل.

## 1.0.1 — 2026-11-22

### Changed
- The polling interval can be set as low as 2 seconds (was 5), for appliances that send no push updates. On the `ARTIK051_PRAC_20K` tested, changes made with the remote showed up only at the polling interval.
- The log says, two minutes after connecting, whether push updates are arriving from the appliance.

### بالعربية
- فترة القراءة الدورية تقبل حتى ثانيتين (كانت 5)، للأجهزة التي لا ترسل تحديثات فورية. على المكيف المجرَّب ظهرت تغييرات الريموت بعد فترة القراءة الدورية.
- يذكر السجل بعد دقيقتين من الاتصال هل تصل التحديثات الفورية من الجهاز.

## 1.0.0 — 2026-11-22

First regular release. Includes the first fixes from a real installation (Homebridge in Docker on a Raspberry Pi). Discovery, live readings and control now run on a real `ARTIK051_PRAC_20K` air conditioner.

### Fixed
- The settings page now hands its configuration to Homebridge on load, so SAVE works on a fresh install and the child bridge option appears.

### Added
- A failed discovery shows technical details: which ports were tried, what the appliance advertised, and the DTLS outcome or alert it answered with.

### Changed
- Fan slider: 0 % now selects Auto (and shows Auto as 0 %), matching homebridge-smartthings-oauth. It still never powers the unit off.
- Discovery may take up to three minutes before giving up (was 90 seconds).

### بالعربية
- أول إصدار فعلي. يعمل الاكتشاف والقراءة والتحكم على مكيف `ARTIK051_PRAC_20K` حقيقي.
- سحب شريط المروحة إلى 0% يختار الوضع التلقائي، ويبقى المكيف يعمل.
- زر SAVE يعمل من أول تثبيت، فيظهر خيار الجسر الفرعي.
- عند فشل الاكتشاف تظهر تفاصيل تقنية: المنافذ التي جُرّبت ورد الجهاز.
- مهلة الاكتشاف صارت حتى ثلاث دقائق.

## 0.1.0-beta.3 — 2026-11-22

Pre-release of the changes that became 1.0.0: fan slider zero selects Auto, SAVE works on a fresh install, technical details on a failed discovery.

### بالعربية
- نسخة تمهيدية للتغييرات التي صارت 1.0.0: شريط المروحة عند 0% يختار التلقائي، وإصلاح زر SAVE، وتفاصيل تقنية عند فشل الاكتشاف.

## 0.1.0-beta.2 — 2026-11-22

No functional change. Still not run against real hardware.

### Changed
- First version published to npm, so it can be found and installed from the Homebridge Plugins search.
- Supported Node.js stated as 22.12+ and 24 (the versions tested in CI).
- Install instructions corrected.

### بالعربية
- أول نسخة تُنشر على npm لتظهر في بحث Plugins داخل Homebridge. دون تغيير في الوظائف.

## 0.1.0-beta.1 — 2026-11-22

First trial release. Not yet run against real hardware.

### Added
- Local connection to Samsung appliances through `smartthings-local` 0.1.25, driven by a helper process the plugin starts and stops.
- Private Python environment prepared automatically inside the Homebridge storage folder.
- Settings page (Arabic and English): add by IP address, test and discover, function table, per-appliance HomeKit options, diagnostics download, data deletion with confirmation.
- Air conditioners: thermostat, fan with Auto and Turbo as explicit choices, Dry and Fan Only switches, WindFree / Fast / Quiet and other comfort modes, swing, display light, humidity, filter, power and energy for Eve-compatible apps.
- Stable device ID for accessory identity; accessories restored from cache while an appliance is unreachable.
- Automatic reconnect with backoff, ordered command queue, shielding of fresh writes from stale reads.

### Known limits
- Washers and other appliance types connect for diagnostics only.
- Samsung TVs, TCP 8888 appliances and appliances that refuse the automatic certificate are not supported.
- No brightness for the display light. No voltage, current or occupancy readings.
- 32-bit systems are not supported.

### بالعربية
- أول نسخة تجريبية: اتصال محلي بأجهزة Samsung، صفحة إعدادات بالعربية والإنجليزية، ودعم المكيفات في HomeKit.
