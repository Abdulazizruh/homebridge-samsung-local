# Changelog

Versions follow [Semantic Versioning](https://semver.org/). Releases are published under the npm tag `latest`; pre-releases under `beta`.

## 1.6.0-beta.15

Trial version on the "beta" channel. Everything in 1.6.0-beta.14, plus:

- **Washer: a sensor for each stage, and one for drum clean (trial, on by default).** The washer already reported its stage; it was read but not shown. Now each stage the washer itself lists (washing, rinsing, spinning) has a sensor that is detected only during that stage, for automations such as a notice when the spin starts. Drum clean has its own sensor for the whole course: a WA80F top-loader names its drum clean as a stage of its own ("Drumcleaning", missing from its own list of stages), and drum clean courses are also known by their course code (Table_02 82 from that washer, the rest from LocalThings' course tables). Each can be switched off in the settings.
- **The course and the last drum clean in the settings and the log.** The Home app shows no free text on a tile. The settings page now shows the selected course (drum clean by name, any other course by its number, since the course tables do not cover every model) and the date of the last drum clean the washer logged. The log says when a cycle starts and each new stage.

**بالعربية**

نسخة تجريبية على قناة «beta». كل ما في 1.6.0-beta.14، ومعه:

- **الغسالة: حساس لكل مرحلة، وحساس لتنظيف الحوض (تجريبي ومفعّل تلقائيًا).** الغسالة كانت تعلن مرحلتها، والإضافة تقرؤها ولا تعرضها. صار لكل مرحلة تعلنها الغسالة نفسها (غسيل، شطف، عصر) حساس يتفعّل وقت تلك المرحلة فقط، ليُبنى عليه أتمتة مثل إشعار عند بدء العصر. ولتنظيف الحوض حساس خاص طوال الدورة: الغسالة العلوية WA80F تعلن تنظيف الحوض مرحلةً قائمة بذاتها («Drumcleaning»، وهي غير موجودة في قائمة مراحلها)، وتُعرف دورات تنظيف الحوض أيضًا برمزها (82 في الجدول Table_02 من تلك الغسالة، والباقي من جداول LocalThings). ويمكن إطفاء كل واحد منها من الإعدادات.
- **الدورة وآخر تنظيف للحوض في الإعدادات والسجل.** تطبيق Home لا يعرض نصًا حرًا على البطاقة. صارت صفحة الإعدادات تعرض الدورة المختارة (تنظيف الحوض باسمه، وأي دورة أخرى برقمها، لأن جداول الدورات لا تغطي كل الموديلات) وتاريخ آخر تنظيف للحوض كما سجّلته الغسالة. والسجل يذكر بداية الدورة وكل مرحلة جديدة.

## 1.6.0-beta.14

Trial version on the "beta" channel. Everything in 1.6.0-beta.13, plus:

- **Polling interval: at least 4 seconds, 5 by default.** One reading of an appliance takes one to two seconds, and a command waits behind a reading in progress. At 2 seconds the next reading started almost as the last ended, so the session was nearly always busy. The minimum is now 4 and the default 5 (it was 15). A value saved below 4 is used as 4 at once: the log says so once at start, and the settings page shows 4 with a note, and stores it with the next save. The plugin never rewrites the saved settings by itself.

**بالعربية**

نسخة تجريبية على قناة «beta». كل ما في 1.6.0-beta.13، ومعه:

- **فترة القراءة الدورية: 4 ثوانٍ على الأقل، و5 افتراضيًا.** القراءة الواحدة للجهاز تأخذ ثانية إلى ثانيتين، والأمر ينتظر خلف القراءة الجارية. ومع ثانيتين كانت القراءة التالية تبدأ فور انتهاء السابقة تقريبًا، فيبقى الاتصال مشغولًا أغلب الوقت. صار الحد الأدنى 4 والافتراضي 5 (كان 15). والقيمة المحفوظة الأقل من 4 تعمل كأنها 4 فورًا: يذكر ذلك السجل مرة عند التشغيل، وتعرض صفحة الإعدادات 4 مع ملاحظة، وتُحفظ مع الحفظ التالي. والإضافة لا تعدّل الإعدادات المحفوظة من نفسها.

## 1.6.0-beta.13

Trial version on the "beta" channel. Everything in 1.6.0-beta.12, plus:

- **An air conditioner tile no longer goes off, back on, and off again.** Switching the display light off (or a mode switch, the fan, swing, the mode or the temperature) showed the new value, then the old one, then the new one again. The plugin already kept a just-set value on the tile while the appliance caught up, but only against readings it pushed itself; when the Home app asked for the tile again in between, it was answered with the appliance's last report, from before the command. Both now follow one rule: the value just set stays until the appliance reports it, or for at most 10 seconds. Switching the unit off counts for every switch and the display too, so none of them is lit again by an earlier reading. How commands are sent is unchanged.

**بالعربية**

نسخة تجريبية على قناة «beta». كل ما في 1.6.0-beta.12، ومعه:

- **مفاتيح المكيف لن تنطفئ ثم تشتغل ثم تنطفئ.** إطفاء الشاشة (أو مفتاح وضع، أو المروحة، أو التأرجح، أو الوضع، أو الحرارة) كان يُظهر القيمة الجديدة، ثم القديمة، ثم الجديدة. الإضافة كانت تُبقي القيمة المطلوبة على البطاقة ريثما يلحق المكيف، لكن أمام القراءات التي ترسلها هي فقط. فإذا سأل تطبيق Home عن البطاقة في الأثناء، أجابته بآخر حالة أبلغ عنها المكيف قبل الأمر. صار الاثنان على قاعدة واحدة: القيمة المطلوبة تبقى حتى يبلغ المكيف عنها، أو 10 ثوانٍ على الأكثر. وإطفاء المكيف نفسه يشمل كل المفاتيح والشاشة، فلا تعيد قراءة قديمة إضاءة أيٍّ منها. طريقة إرسال الأوامر لم تتغير.

## 1.6.0-beta.12

Trial version on the "beta" channel. Everything in 1.6.0-beta.11, plus:

- **A remote press while the TV is shown as off is no longer dropped without a word.** The plugin asks the TV every 4 seconds whether it is on. A TV switched on a moment ago, or one that missed one question, was still shown as off until the next round, and every press of the iPhone remote and the Home remote in that time was dropped silently: the remote did nothing, then worked. Now a press on a TV shown as off asks the TV at once and is sent if it answers. One that still does not answer is written to the log, at most once a minute.
- **The log says what became of each iPhone remote's presses.** The "remote closed" line now counts its button presses and touch moves: how many reached the TV, how many were not sent because the TV was off, and how many failed. Counts only; no button names and no typed text.

**بالعربية**

نسخة تجريبية على قناة «beta». كل ما في 1.6.0-beta.11، ومعه:

- **زر الريموت والتلفزيون يظهر مطفأً لن يضيع بصمت.** الإضافة تسأل التلفزيون كل 4 ثوانٍ هل هو شغّال. فالتلفزيون الذي شُغّل للتو، أو فاته سؤال، كان يبقى مطفأً عند الإضافة حتى السؤال التالي، وكل ضغطة من ريموت الآيفون أو ريموت Home في تلك المدة كانت تضيع دون أثر: الريموت لا يستجيب، ثم يعمل. صارت الضغطة على تلفزيون يظهر مطفأً تسأله فورًا، وتُرسل إن ردّ. وإن لم يردّ كُتب ذلك في السجل، مرة في الدقيقة على الأكثر.
- **السجل يذكر ما جرى لضغطات كل ريموت آيفون.** سطر «إغلاق الريموت» صار يعدّ الضغطات وحركات اللمس: كم وصل إلى التلفزيون، وكم لم يُرسل لأن التلفزيون مطفأ، وكم فشل. أعداد فقط، دون أسماء الأزرار ودون أي نص مكتوب.

## 1.6.0-beta.11

Trial version on the "beta" channel. Everything in 1.6.0-beta.10, plus:

- **No reading right after a command, in both engines.** The plugin read the appliance 1.5 seconds after every command. smartthings-local and LocalThings, the projects the connection comes from, both document that reading a resource just after writing it makes some Samsung appliances put the old value back, and both wait about 4 seconds first. A reading also holds the session the next command needs, so a slow one made the next temperature step wait behind it; in the last log two steps waited 15 seconds each and failed. The plugin now waits 4 seconds after the last command before it reads, so taps that keep coming are sent one after another with no reading in between. homebridge-smartthings does the same over the cloud: commands go first, and it pauses its readings after a command. Each step is still sent in turn, as in beta.10.

**بالعربية**

نسخة تجريبية على قناة «beta». كل ما في 1.6.0-beta.10، ومعه:

- **لا تُقرأ حالة الجهاز بعد الأمر مباشرة، في المحركين.** كانت الإضافة تقرأ الجهاز بعد كل أمر بـ1.5 ثانية. ومشروعا smartthings-local وLocalThings، وهما مصدر الاتصال، يوثّقان أن قراءة الحالة بعد الأمر مباشرة تجعل بعض أجهزة سامسونج ترجع إلى القيمة القديمة، فينتظران نحو 4 ثوانٍ قبل القراءة. والقراءة تشغل الجلسة التي يحتاجها الأمر التالي، فإذا أبطأت انتظرت خطوة الحرارة التالية خلفها. وفي آخر سجل انتظرت خطوتان 15 ثانية لكل واحدة ثم فشلتا. صارت الإضافة تنتظر 4 ثوانٍ بعد آخر أمر ثم تقرأ، فتُرسل اللمسات المتتالية واحدة بعد الأخرى دون قراءة بينها. وهذا ما يفعله homebridge-smartthings عبر السحابة: الأوامر أولًا، ويوقف القراءة مدة بعد الأمر. وتبقى كل خطوة تُرسل بدورها كما في beta.10.

## 1.6.0-beta.10

Trial version on the "beta" channel. Everything in 1.6.0-beta.9, except one change taken back:

- **Temperature steps are sent as in 1.6.0-beta.8 again.** In beta.9, while one temperature was on its way, only the newest one asked for was sent after it. On a real air conditioner that made a run of taps send only the first; the ones after it waited and failed. Each step is again sent in turn, as before. The quick second handshake after a restart (beta.9) stays.

**بالعربية**

نسخة تجريبية على قناة «beta». كل ما في 1.6.0-beta.9، إلا تغييرًا واحدًا أُلغي:

- **خطوات الحرارة تُرسل كما في 1.6.0-beta.8.** في beta.9 كانت الإضافة، ما دامت حرارة في طريقها، ترسل بعدها أحدث قيمة طُلبت فقط. وعلى مكيف حقيقي جعل ذلك اللمسات المتتالية ترسل أولها فقط، وما بعده ينتظر ثم يفشل. فرجعت كل خطوة تُرسل بدورها كما كانت. وتبقى المصافحة الثانية السريعة بعد إعادة التشغيل (beta.9).

## 1.6.0-beta.9

Trial version on the "beta" channel. Everything in 1.6.0-beta.8, plus:

- **After a restart, an appliance that refuses the first handshake is asked again at once, in both engines.** Taking turns two at a time (beta.7) did not stop it: the next restarts still showed two or three appliances answering "decode error" or "handshake failure" and connecting only on a later round. The cause is documented by the connection library itself: a plugin that stops without closing its sessions leaves them open on the appliance, and the next handshake from the same address and port is refused once while the appliance drops the old one; the one after it goes through. The plugin used to wait 5 seconds or more before that second try, sometimes much longer; it now tries again after 0.3 seconds. A try that timed out (an appliance switched off at the wall) is not repeated on the spot.
- **Temperature tapped up or down step by step no longer slows down.** Each step was sent to the air conditioner in turn, each waiting for the one before, so a run of taps queued up and the last one arrived late. While one temperature is on its way, only the newest one asked for is sent after it. The newest value is shown at once, also when the Home app asks again in between.

**بالعربية**

نسخة تجريبية على قناة «beta». كل ما في 1.6.0-beta.8، ومعه:

- **بعد إعادة التشغيل، الجهاز الذي يرفض المصافحة الأولى يُسأل ثانية فورًا، في المحركين.** التناوب اثنين اثنين (beta.7) لم يحل المشكلة: إعادات التشغيل التالية أظهرت جهازين أو ثلاثة يردّون «decode error» أو «handshake failure» ولا يتصلون إلا في جولة لاحقة. والسبب موثّق في مكتبة الاتصال نفسها: الإضافة التي تتوقف دون إغلاق جلساتها تتركها مفتوحة على الجهاز، فيرفض الجهاز أول مصافحة من العنوان والمنفذ نفسيهما مرة واحدة وهو يُسقط القديمة، وتنجح التي بعدها. كانت الإضافة تنتظر 5 ثوانٍ أو أكثر قبل المحاولة الثانية، وأحيانًا أطول بكثير. صارت تعيدها بعد 0.3 ثانية. أما المحاولة التي انتهت مهلتها (جهاز مفصول عن الكهرباء) فلا تُعاد في الحال.
- **تغيير الحرارة خطوة خطوة لن يبطئ.** كانت كل خطوة تُرسل إلى المكيف بدورها، وكل واحدة تنتظر التي قبلها، فتتراكم اللمسات وتصل الأخيرة متأخرة. صارت الإضافة، ما دامت حرارة في طريقها، ترسل بعدها أحدث قيمة طُلبت فقط. وأحدث قيمة تظهر فورًا، حتى لو سأل تطبيق Home عنها مرة أخرى في الأثناء.

## 1.6.0-beta.8

Trial version on the "beta" channel. Everything in 1.6.0-beta.7, plus:

- **A temperature set from Apple Home no longer flips back and forth.** An air conditioner that applied a command but reported it a few seconds late made the tile show the old value again, then the new one. The requested value now stays on the tile for up to 10 seconds while the appliance catches up (it was 4.5). An appliance that has still not applied it after 12 seconds is reported, as before.
- **Settings: how long reading each appliance takes, and whether its push updates arrive.** Under "Command response", each appliance card now shows "State read (average)" and whether a change made elsewhere (the SmartThings app, the appliance's own remote) arrives at once or only at the next read. Measured the same way in both engines, so a slow appliance can be told apart from a slow network.

**بالعربية**

نسخة تجريبية على قناة «beta». كل ما في 1.6.0-beta.7، ومعه:

- **الحرارة التي تُضبط من Apple Home لن ترجع ثم تتقدم.** المكيف الذي يطبّق الأمر ويبلّغ عنه بعد ثوانٍ كان يجعل البطاقة تعرض القيمة القديمة ثم الجديدة. صارت القيمة المطلوبة تبقى على البطاقة حتى 10 ثوانٍ ريثما يلحق المكيف (كانت 4.5). والمكيف الذي لم يطبّقها بعد 12 ثانية يُبلَّغ عنه كما كان.
- **الإعدادات: زمن قراءة كل جهاز، وهل تصل تحديثاته فورًا.** تحت «زمن استجابة الأمر» صارت بطاقة كل جهاز تعرض «زمن قراءة الحالة (متوسط)»، وهل التغيير من مكان آخر (تطبيق SmartThings أو ريموت المكيف) يصل فورًا أم مع القراءة التالية. يُقاس بالطريقة نفسها في المحركين، فيُعرف المكيف البطيء من الشبكة البطيئة.

## 1.6.0-beta.7

Trial version on the "beta" channel. Everything in 1.6.0-beta.6, plus:

- **Pointer: a tap clicks what the pointer shows.** Tried on a real TV in beta.6: the pointer moved well, but a tap selected whatever had the focus (a card elsewhere, or the first place the pointer had been), and on the TV keyboard a letter needed two taps. A tap right after the pointer moved is now a mouse click where it points (the command Samsung's own phone app sends). Once the pointer has been still for 8 seconds, the TV hides it and a tap is Select again.
- **Appliances starting together take turns for the handshake, two at a time, in both engines.** After a restart, two or three appliances answered the first try with a TLS alert ("decode error", "handshake failure") and connected only on a later round, sometimes 45 seconds later. With every appliance handshaking at once, each answer comes late; two at a time keeps each prompt. This is a cause read from the logs, not yet confirmed: the next restart's log will show whether the alerts are gone.

**بالعربية**

نسخة تجريبية على قناة «beta». كل ما في 1.6.0-beta.6، ومعه:

- **المؤشر: اللمسة تضغط ما يشير إليه.** جُرِّب على تلفزيون حقيقي في beta.6: الحركة جيدة، لكن اللمسة كانت تختار ما عليه التحديد (بطاقة في مكان آخر، أو أول مكان كان فيه المؤشر)، وفي كيبورد التلفزيون احتاج الحرف لمستين. صارت اللمسة بعد تحريك المؤشر ضغطة ماوس في مكانه (الأمر نفسه الذي يرسله تطبيق Samsung للجوال). وإذا بقي المؤشر ساكنًا 8 ثوانٍ يخفيه التلفزيون وتعود اللمسة «اختيار».
- **الأجهزة التي تبدأ معًا تتناوب على المصافحة، اثنين اثنين، في المحركين.** بعد إعادة التشغيل كان جهازان أو ثلاثة يردّون على المحاولة الأولى بتنبيه TLS ‏(«decode error» أو «handshake failure») ولا يتصلون إلا في جولة لاحقة، أحيانًا بعد 45 ثانية. عندما يصافح الجميع في وقت واحد يتأخر كل رد، واثنان في كل مرة يُبقي كل مصافحة سريعة. هذا سبب مقروء من السجل ولم يتأكد بعد: سجل إعادة التشغيل القادمة سيُظهر هل اختفت التنبيهات.

## 1.6.0-beta.6

Trial version on the "beta" channel. Everything in 1.6.0-beta.5, plus:

- **Settings: each trial control keeps its name, its "trial" tag and its "Not working?" button on one line,** where a long name used to push the button onto a line of its own.
- **Easier to find in the Homebridge plugin search.** Searching for SmartThings, Samsung, TV, AC, air conditioner, washer or air purifier, or in Arabic (سامسونج، مكيف، تلفزيون، سمارت ثينقز), now matches this plugin's keywords exactly. The search reads what npm holds for the full release, so this shows once 1.6.0 is out.
- **The project page has pictures of the new settings:** the list grouped by kind, an opened appliance card with the bar for changes not saved yet, the touch-area choice of the remote like Apple TV, and the options of an air purifier. The Arabic page shows them in Arabic.

**بالعربية**

نسخة تجريبية على قناة «beta». كل ما في 1.6.0-beta.5، ومعه:

- **الإعدادات: كل وظيفة تجريبية يبقى اسمها ووسم «تجريبي» وزر «لا تعمل؟» في سطر واحد،** وكان الاسم الطويل يدفع الزر إلى سطر وحده.
- **أسهل في الظهور ضمن بحث الإضافات في Homebridge.** البحث بكلمة SmartThings أو Samsung أو TV أو AC أو air conditioner أو washer أو air purifier، أو بالعربية (سامسونج، مكيف، تلفزيون، سمارت ثينقز)، صار يطابق كلمات هذه الإضافة تمامًا. يقرأ البحث بيانات النسخة الرسمية من npm، فيظهر الأثر بعد نشر 1.6.0.
- **صفحة المشروع فيها صور الإعدادات الجديدة:** القائمة المصنّفة حسب النوع، وبطاقة جهاز مفتوحة مع شريط التغييرات غير المحفوظة، واختيار مساحة اللمس في الريموت الذي مثل Apple TV، وخيارات منقي الهواء. والصفحة العربية تعرضها بالعربية.

## 1.6.0-beta.5

Trial version on the "beta" channel. Everything in 1.6.0-beta.4, plus:

- **Settings: safe to scroll with a finger.** Each appliance is now one line: its name, its state and, for an air conditioner in use, its power. The only thing to press on that line is an arrow at its edge (on the right in English, on the left in Arabic), which opens the appliance's card. Nothing else on the line reacts to a touch, so scrolling over it cannot change anything.
- **Nothing was removed from a card.** Opened, it holds what it held before: address, energy, the TV's pairing code and QR, response time, Options, Rename, Change IP, Diagnostics, On, Remove (which still asks twice).
- **Changes not saved yet are shown.** A change inside open options brings up a bar at the bottom: "Unsaved changes in …", with Undo and Save. Nothing is saved before Save or Update is pressed, as before.

**بالعربية**

نسخة تجريبية على قناة «beta». كل ما في 1.6.0-beta.4، ومعه:

- **الإعدادات: التمرير بالإصبع آمن.** كل جهاز صار سطرًا واحدًا: اسمه وحالته، وللمكيف الذي يعمل قدرته. الشيء الوحيد الذي يُضغط في هذا السطر سهم في طرفه (يسارًا في العربية ويمينًا في الإنجليزية) يفتح بطاقة الجهاز. ولا يستجيب باقي السطر للمس، فالتمرير فوقه لن يغيّر شيئًا.
- **لم يُحذف شيء من البطاقة.** إذا فُتحت ففيها ما كان فيها: العنوان، الطاقة، رمز إضافة التلفزيون والباركود، زمن الاستجابة، الخيارات، تغيير الاسم، تغيير العنوان، التشخيص، التفعيل، والحذف (وما زال يطلب ضغطتين).
- **التغييرات غير المحفوظة تظهر.** أي تغيير داخل الخيارات المفتوحة يُظهر شريطًا في الأسفل: «تغييرات لم تُحفظ في …» مع «تراجع» و«حفظ». ولا يُحفظ شيء قبل ضغط «حفظ» أو «تحديث»، كما كان.

## 1.6.0-beta.4

Trial version on the "beta" channel. Everything in 1.6.0-beta.3, plus:

- **Settings: the touch-area choice is where it is looked for.** In 1.6.0-beta.3 it was a drop-down far down the page, under the pairing code, and was missed. It now sits right under the remote choice, as two cards with a picture each: "Arrows" (tested) and "Pointer" (trial). It shows only while a remote like Apple TV is chosen.

**بالعربية**

نسخة تجريبية على قناة «beta». كل ما في 1.6.0-beta.3، ومعه:

- **الإعدادات: اختيار مساحة اللمس في المكان الذي يُبحث عنه فيه.** كان في 1.6.0-beta.3 قائمة منسدلة في أسفل الصفحة تحت رمز الاقتران، فلم يُلاحَظ. صار الآن تحت اختيار الريموت مباشرة، بطاقتين لكل منهما رمز: «أسهم» (مجرَّب) و«مؤشر» (تجريبي). ويظهر فقط عند اختيار ريموت مثل Apple TV.

## 1.6.0-beta.3

Trial version on the "beta" channel. Everything in 1.6.0-beta.2, plus:

- **The remote like Apple TV: its touch area can be a pointer (trial).** A new choice in the TV's options: "Arrows" (as before, and the default) or "Pointer", where the finger moves a pointer on the TV like a mouse. A tap is still Select; buttons and keyboard are unchanged. The pointer shows in the TV's browser and in some apps; elsewhere nothing moves. Not yet tried on a real TV. The TV tile in Apple Home cannot do this: Apple sends it arrows and Select only.

**بالعربية**

نسخة تجريبية على قناة «beta». كل ما في 1.6.0-beta.2، ومعه:

- **الريموت الذي مثل Apple TV: مساحة اللمس تصير مؤشرًا (تجريبي).** خيار جديد في خيارات التلفزيون: «أسهم» (كما كان، وهو الافتراضي) أو «مؤشر»، وفيه يحرّك الإصبع مؤشرًا على التلفزيون مثل الماوس. اللمسة تبقى «اختيار»، والأزرار والكيبورد كما هي. المؤشر يظهر في متصفح التلفزيون وبعض التطبيقات، وفي غيرها لن يتحرك شيء. لم يُجرَّب بعد على تلفزيون حقيقي. بطاقة التلفزيون في Apple Home يتعذر عليها ذلك: Apple يرسل إليها الأسهم و«اختيار» فقط.

## 1.6.0-beta.2

Trial version on the "beta" channel. Everything in 1.6.0-beta.1, plus:

- **Settings: the device list is grouped by kind.** Air conditioners, laundry, TVs, air purifiers and dehumidifiers, refrigerators, robot vacuums, cooking, other. A group exists only while it has a device, and its title shows how many it holds and how many are connected. A group can be folded; the page remembers it, and opens the group again when a device joins or leaves it. Nothing inside a device's card changed: name, address, pairing code, options, diagnostics and removal are where they were.

**بالعربية**

نسخة تجريبية على قناة «beta». كل ما في 1.6.0-beta.1، ومعه:

- **الإعدادات: قائمة الأجهزة مصنّفة حسب النوع.** المكيفات، الغسيل، التلفزيونات، منقيات الهواء ومزيلات الرطوبة، الثلاجات، المكانس الآلية، الطبخ، وأجهزة أخرى. المجموعة تظهر ما دام فيها جهاز، وعنوانها يعرض عدد أجهزتها والمتصل منها. تُطوى المجموعة وتتذكر الصفحة ذلك، وتفتحها من جديد عند انضمام جهاز إليها أو خروجه منها. بطاقة الجهاز نفسها لم يتغير فيها شيء: الاسم والعنوان ورمز الإضافة والخيارات والتشخيص والحذف في أماكنها.

## 1.6.0-beta.1

Trial version on the "beta" channel. Everything in 1.5.1-beta.2, plus the first step beyond air conditioners, washers and TVs:

- **Other Samsung appliances get an accessory.** Air purifiers, dehumidifiers, refrigerators, robot vacuums, ovens and the like were found and only listed for diagnostics. One shared reader now turns what each reports into HomeKit parts: air quality, filters, a temperature per zone, a contact sensor per door, humidity, battery, a "running" sensor for ovens, power and energy in Eve.
- **Controls are offered as trials.** Power, fan speed and automatic mode (air purifier, dehumidifier), target humidity (dehumidifier), the temperature of each zone, Power Cool and Power Freeze (refrigerator), start a run and back to the station (robot vacuum). They are built from recorded appliances of the same families and have not been confirmed on a real one by this project, so each carries the word "trial" in the settings. A command counts as done only once the appliance accepted it; a few seconds later the tile shows what the appliance itself reports.
- **Settings: untick to remove, one tap to report.** Each reading and control has its own tick. Next to every trial control a "Not working?" button opens a ready report on GitHub with the type, model, function and plugin version filled in. The plugin sends nothing by itself.
- **Ovens, ranges, microwaves and cooktops are shown, never commanded.**
- **Names work as on the air conditioners.** The name given in the plugin settings reaches every tile of the appliance ("Kitchen Freezer", "Kitchen Door 2", "Purifier Air Quality"); a tile renamed in the Home app keeps its name.
- **Nothing changes for air conditioners, washers and TVs.** They keep their own tested accessories; the shared reader is used only for the other kinds.

Sources: the resource names and value shapes follow the recorded appliances and registry of LocalThings (MIT); the choice of HomeKit service per function follows homebridge-smartthings (Apache-2.0). Both are credited in the README.

**بالعربية**

نسخة تجريبية على قناة «beta». كل ما في 1.5.1-beta.2، ومعه أول خطوة أبعد من المكيفات والغسالات والتلفزيونات:

- **أجهزة Samsung الأخرى صار لها ملحق.** منقيات الهواء ومزيلات الرطوبة والثلاجات والمكانس الآلية والأفران وما شابهها كانت تُكتشف وتُعرض للتشخيص فقط. قارئ واحد مشترك يحوّل الآن ما يعلنه كل جهاز إلى أجزاء في HomeKit: جودة الهواء، الفلاتر، حرارة لكل قسم، حساس فتح لكل باب، الرطوبة، البطارية، حساس «يعمل» للأفران، والقدرة والطاقة في Eve.
- **وظائف التحكم تُعرض كتجريبية.** التشغيل وسرعة المروحة والوضع التلقائي (المنقي ومزيل الرطوبة)، الرطوبة المطلوبة (مزيل الرطوبة)، ضبط حرارة كل قسم والتبريد السريع والتجميد السريع (الثلاجة)، بدء التنظيف والعودة إلى المحطة (المكنسة). بُنيت من أجهزة مسجَّلة من العائلات نفسها ولم يؤكدها هذا المشروع على جهاز حقيقي، فكل واحدة تحمل كلمة «تجريبي» في الإعدادات. يُعدّ الأمر منفَّذًا بعد أن يقبله الجهاز فقط، وبعد ثوانٍ تعرض البطاقة ما يعلنه الجهاز نفسه.
- **الإعدادات: أزل العلامة للإخفاء، وضغطة واحدة للإبلاغ.** لكل قراءة ووظيفة علامتها. وبجانب كل وظيفة تجريبية زر «لا تعمل؟» يفتح تقريرًا جاهزًا في GitHub فيه النوع والموديل والوظيفة ورقم الإضافة. الإضافة لا ترسل شيئًا من تلقاء نفسها.
- **الأفران والمواقد والميكروويف تُعرض ولا تُرسَل إليها أوامر.**
- **الأسماء كما في المكيفات.** الاسم المكتوب في إعدادات الإضافة يصل إلى كل بطاقة في الجهاز، ثم يليه اسم الجزء (مثل «Kitchen Freezer» و«Purifier Air Quality»). والبطاقة التي غُيّر اسمها من تطبيق Home تحتفظ باسمها.
- **المكيفات والغسالات والتلفزيونات كما هي.** تبقى على ملحقاتها المجرَّبة، والقارئ المشترك يُستعمل للأنواع الأخرى فقط.

المصادر: أسماء القراءات وأشكال قيمها من الأجهزة المسجَّلة وسجل LocalThings (MIT)، واختيار خدمة HomeKit لكل وظيفة من homebridge-smartthings (Apache-2.0). كلاهما مذكور في README.

## 1.5.1-beta.2

Trial version on the "beta" channel. Two corrections to 1.5.1-beta.1:

- **TV: "off" from Apple Home could switch a TV on.** Since beta.1 a TV that missed one answer stayed shown as on. A power command then acted on that older picture: a TV already put in standby with its own remote received the power key, which is a toggle, and came on while Apple Home showed it as off. A power command now needs a fresh answer from the TV, as in 1.5.0; the calmer display for one missed answer stays.
- **A dishwasher is called a dishwasher.** Its type name contains "washer" and was matched as a washer. It is now recognised by its own name.

**بالعربية**

نسخة تجريبية على قناة «beta». تصحيحان على 1.5.1-beta.1:

- **التلفزيون: أمر «إطفاء» من Apple Home كان قد يشغّل التلفزيون.** منذ beta.1 يبقى التلفزيون الذي فاته ردّ واحد معروضًا يعمل. وكان أمر الطاقة يعتمد على تلك الصورة القديمة: فالتلفزيون الذي وُضع في الاستعداد من ريموته يصله زر الطاقة، وهو زر تبديل، فيشتغل بينما Apple Home يعرضه مطفأ. الآن يحتاج أمر الطاقة إلى ردّ حديث من التلفزيون كما في 1.5.0، ويبقى العرض الهادئ عند غياب ردّ واحد.
- **غسالة الصحون تُسمّى باسمها.** اسم نوعها يحتوي كلمة «washer» فكانت تُطابَق كغسالة ملابس. الآن تُعرَف باسمها.

## 1.5.1-beta.1

Trial version on the "beta" channel. Everything in 1.5.0, plus a first step on appliances that fail their first connection after a restart:

- **The log says why an appliance refused.** When an air conditioner or washer turns down the secure session, the reason it gives was known to the Python engine but not written. The "not reachable" line now ends with it, for example "the appliance said: sslv3 alert handshake failure". Only those protocol words are written, never an address or a key. This is what is needed to find why some appliances fail the first try at start and connect on the second.
- **A second try at once in one known case.** An appliance that was itself reaching for the plugin's address refuses the first try and clears its side by doing so. The plugin now tries again after a third of a second, in place of waiting for the next round and writing a warning. (Python engine; the JavaScript engine does not tell this case apart yet.)
- **Settings: when to choose both remotes.** The choice "Both together" is no longer marked "not recommended". Each choice now says where it works: the remote like Apple TV on the home network only, the Apple Home tile at home and away (through a home hub), and both together for the keyboard at home with the reach from outside.
- **iPhone remote: a starting session is protected.** A connection that had asked for its session, but had not yet opened the remote, could be closed when the same phone connected once more. It is now kept from the moment it asks.
- **One line an hour with the figure that matters.** How many times the remote was opened, how many of those came after a short delay, and how many connections opened no remote.
- **A TV that was on is not shown as off for one missed answer.** It is asked again at the next round; two silences in a row show it as off. A TV that says it went to standby is believed at once.
- **An appliance switched off at the wall is said calmly.** Silence from the start is written once as information, with a note that it connects by itself when it is back, in place of a warning.
- **Settings: a cleared pairing code is really cleared.** Emptying a custom code showed 0000 but kept the old code when saved. The chosen remote also shows the name the TV will have in the iPhone's remote list.
- **Releases: the channel follows the kind of release.** A trial version can no longer reach everyone because a question to the registry failed; a version number and a release kind that disagree publish nothing.

**بالعربية**

نسخة تجريبية على قناة «beta». كل ما في 1.5.0، ومعها خطوة أولى في الأجهزة التي تفشل محاولتها الأولى بعد إعادة التشغيل:

- **السجل يذكر لماذا رفض الجهاز.** حين يرفض مكيف أو غسالة الجلسة الآمنة، كان محرك Python يعرف السبب الذي يعطيه الجهاز ولا يكتبه. الآن ينتهي سطر «not reachable» به، مثل «the appliance said: sslv3 alert handshake failure». تُكتب كلمات البروتوكول هذه فقط، دون أي عنوان أو مفتاح. وهذا ما نحتاجه لمعرفة لماذا تفشل بعض الأجهزة في المحاولة الأولى عند البدء وتتصل في الثانية.
- **محاولة ثانية فورية في حالة معروفة.** الجهاز الذي كان هو نفسه يحاول الوصول إلى عنوان الإضافة يرفض المحاولة الأولى ويصفّي جهته بذلك. الآن تحاول الإضافة من جديد بعد ثلث ثانية، بدل انتظار الجولة التالية وكتابة تحذير. (محرك Python؛ ومحرك JavaScript لا يميّز هذه الحالة بعد.)
- **الإعدادات: متى تختار الريموتين معًا.** اختيار «الاثنان معًا» لم يعد معلَّمًا «لا نوصي به». وصار كل اختيار يذكر أين يعمل: الريموت الذي مثل Apple TV داخل شبكة البيت فقط، وبطاقة Apple Home داخل البيت وخارجه (عبر المركز المنزلي)، والاثنان معًا للكيبورد داخل البيت مع الوصول من خارجه.
- **ريموت الآيفون: الجلسة التي تبدأ محمية.** الاتصال الذي طلب جلسته ولم يفتح الريموت بعد كان يمكن أن يُغلق حين يتصل الجوال نفسه مرة أخرى. الآن يُحفظ من لحظة طلبه.
- **سطر واحد كل ساعة بالرقم المهم.** كم مرة فُتح الريموت، وكم منها جاء بعد تأخير قصير، وكم اتصالًا لم يفتح ريموتًا.
- **التلفزيون الذي كان يعمل لا يُعرض مطفأ بسبب ردّ واحد غائب.** يُسأل من جديد في الجولة التالية؛ وسكوتان متتاليان يعرضانه مطفأ. والتلفزيون الذي يقول إنه دخل الاستعداد يُصدَّق فورًا.
- **الجهاز المفصول من الكهرباء يُذكر بهدوء.** السكوت من البداية يُكتب مرة واحدة معلومةً، مع ملاحظة أنه يتصل من نفسه حين يعود، بدل تحذير.
- **الإعدادات: رمز الاقتران الممسوح يُمسح فعلًا.** تفريغ رمز مخصص كان يعرض 0000 لكنه يحتفظ بالرمز القديم عند الحفظ. والريموت المختار يعرض أيضًا الاسم الذي سيظهر به التلفزيون في قائمة الريموت على الآيفون.
- **الإصدارات: القناة تتبع نوع الإصدار.** لم يعد ممكنًا أن تصل نسخة تجريبية إلى الجميع لأن سؤال السجل فشل؛ ورقم نسخة ونوع إصدار لا يتفقان لا يُنشر معهما شيء.

## 1.5.0

Everything tried in the 1.4.0 beta versions, as one release. Your settings, pairings and accessories are kept as they are.

**New for TVs**

- **A remote like Apple TV (trial).** A TV can appear in the Control Centre remote the way an Apple TV does, with a touch area and with the iPhone keyboard, which opens when the TV opens one of its own text fields (TV search, settings, browser). It is paired once on each iPhone, iPad or Apple Watch with a four-digit code: 0000 unless you choose your own in the TV's options. Typing, deleting, moving the cursor and accepting suggestions follow what the phone shows. It works inside this plugin and stays on your home network.
- **Switches for automations (optional).** Power, mute, volume up and down, channel up and down, play/pause and home, each as a switch and all grouped under one accessory, for automations and scenes. Off unless you tick it; you choose which ones appear.
- **TV options in two cards.** First the remote: like Apple TV (recommended, trial), the TV tile with the Home remote, both (not recommended), or none. Then the switches for automations, separate from the remote.
- **A TV tile keeps its place in Apple Home.** Each tile now keeps the same network port across restarts, with nothing to edit by hand. A tile that answered only some of the time after a restart is steady.

**Known limits of the remote like Apple TV**

- About one opening in three is delayed by one to five seconds, and the phone may show "Can't Connect" for a moment before it connects. The cause is on the phone's side of an unpublished protocol and is not yet understood.
- Apps with their own keyboard, such as YouTube and Netflix, do not accept typed text.
- It is unofficial: an iOS update may break it. Choosing a set-up without it removes everything it stored.

**Log**

- The everyday log is short: one line when an appliance connects or is lost, when a remote or the TV keyboard opens and closes, and for anything unexpected. Timings, the steps of the iPhone remote and typing (lengths only, never the text) are written in Homebridge debug mode. Once an hour, one line counts the phone connections that did not open a remote.

**Going back** to a version before 1.5.0: first choose a TV set-up without the remote like Apple TV and press Update, then install the older version. Nothing is left in the system.

**بالعربية**

كل ما جُرّب في نسخ 1.4.0 التجريبية، في إصدار واحد. إعداداتك واقتراناتك وأجهزتك في Apple Home تبقى كما هي.

**جديد التلفزيونات**

- **ريموت مثل Apple TV (تجريبي).** يمكن أن يظهر التلفزيون في ريموت مركز التحكم كما يظهر Apple TV، بمنطقة لمس وبلوحة مفاتيح الآيفون، وتُفتح حين يفتح التلفزيون أحد حقول الكتابة الخاصة به (بحث التلفزيون، الإعدادات، المتصفح). يُقرن مرة واحدة على كل آيفون أو آيباد أو Apple Watch برمز من أربعة أرقام: 0000 ما لم تختر رمزك من خيارات التلفزيون. الكتابة والحذف وتحريك المؤشر وقبول الاقتراحات تتبع ما يعرضه الجوال. يعمل داخل هذه الإضافة ولا يخرج من شبكة بيتك.
- **مفاتيح للأتمتة (اختياري).** التشغيل، كتم الصوت، رفع الصوت وخفضه، القناة التالية والسابقة، تشغيل/إيقاف مؤقت، والصفحة الرئيسية: كل منها مفتاح، وكلها مجموعة تحت ملحق واحد، للأتمتة والمشاهد. متوقفة ما لم تفعّلها، وأنت تختار ما يظهر منها.
- **خيارات التلفزيون في بطاقتين.** الأولى للريموت: مثل Apple TV (موصى به، تجريبي)، أو بطاقة التلفزيون مع ريموت Home، أو الاثنان معًا (لا يُنصح به)، أو دون ريموت. والثانية لمفاتيح الأتمتة، منفصلة عن الريموت.
- **بطاقة التلفزيون تثبت في Apple Home.** كل بطاقة تحتفظ الآن بمنفذ الشبكة نفسه بعد كل إعادة تشغيل، دون أي تعديل يدوي. والبطاقة التي كانت تستجيب أحيانًا فقط بعد إعادة التشغيل صارت ثابتة.

**حدود معروفة للريموت الذي مثل Apple TV**

- نحو فتح واحد من كل ثلاثة يتأخر من ثانية إلى خمس ثوانٍ، وقد يعرض الجوال «Can't Connect» لحظة قبل أن يتصل. السبب في جهة الجوال من بروتوكول غير منشور، ولم يُفهم بعد.
- التطبيقات التي لها لوحة مفاتيح خاصة، مثل YouTube و Netflix، لا تقبل النص المكتوب.
- هو غير رسمي: قد يعطّله تحديث iOS. واختيار إعداد دونه يحذف كل ما خزّنه.

**السجل**

- السجل اليومي قصير: سطر واحد حين يتصل جهاز أو ينقطع، وحين يُفتح الريموت أو لوحة مفاتيح التلفزيون ويُغلقان، ولكل ما هو غير متوقع. الأزمنة وخطوات ريموت الآيفون والكتابة (الأطوال فقط دون النص) تُكتب في وضع Debug في Homebridge. ومرة كل ساعة، سطر واحد يعدّ اتصالات الجوال التي لم تفتح ريموتًا.

**للرجوع** إلى نسخة قبل 1.5.0: اختر أولًا إعدادًا للتلفزيون دون الريموت الذي مثل Apple TV واضغط «تحديث»، ثم ثبّت النسخة الأقدم. ولا يبقى شيء في النظام.

## 1.4.0-beta.34

Trial version on the "beta" channel. Same behaviour as beta.33 (and beta.30) towards silent connections; two changes in how the stand-in talks, aimed at the flicker:

- **Answers are worded as an Apple TV words them.** Every answer the stand-in gave also carried the name of the request it answered. An Apple TV's answers carry the request's number, their kind and their content, and nothing else. A phone that asks for a remote the moment it connects did not mind; a phone that connects first and asks a moment later may have been waiting for an answer it did not recognise as one, which would be the silent connection and the flicker that follows its closing. A trial: not yet confirmed.
- **The phone's messages are read as it numbers them.** A phone may point back at something it wrote earlier in the same message, by number. The reader did not count lists and dictionaries among the numbered things, as the phone does, so such a pointer could land one or more places off. That is what made some introductions look "worded in another order". Counting is now the phone's, checked against the open implementation other projects use with real Apple TVs.

**بالعربية**

نسخة تجريبية على قناة «beta». السلوك تجاه الاتصالات الساكتة مثل beta.33 (وbeta.30)؛ وتغييران في طريقة كلام البديل، هدفهما الرمش:

- **الردود تُصاغ كما يصوغها تلفزيون Apple.** كل ردّ من البديل كان يحمل أيضًا اسم الطلب الذي يردّ عليه. ردود تلفزيون Apple تحمل رقم الطلب ونوع الرسالة ومحتواها فقط. الجوال الذي يطلب الريموت لحظة اتصاله لم يتأثر؛ أما الجوال الذي يتصل أولًا ثم يطلب بعد لحظة فربما كان ينتظر ردًّا لم يتعرّف عليه ردًّا، وهذا هو الاتصال الساكت والرمش الذي يتبع إغلاقه. تجربة: لم تتأكد بعد.
- **رسائل الجوال تُقرأ كما يرقّمها هو.** الجوال قد يشير بالرقم إلى شيء كتبه قبل قليل في الرسالة نفسها. القارئ لم يكن يعدّ القوائم والقواميس ضمن ما يُرقَّم، كما يفعل الجوال، فكانت الإشارة تقع في غير موضعها. وهذا ما جعل بعض رسائل التعريف تبدو «بصياغة أخرى». العدّ صار مثل عدّ الجوال، ومطابقًا للتنفيذ المفتوح الذي تستخدمه مشاريع أخرى مع أجهزة Apple TV الحقيقية.

## 1.4.0-beta.33

Trial version on the "beta" channel. Goes back to how beta.30 behaved, which worked nearly every time:

- **The TV is back in the phone's remote list.** beta.31 announced a tag that lets a paired phone recognise the stand-in as its own device, and beta.32 left such a phone's connections open. The phones did recognise it, but then expected more of it than the stand-in can answer yet: they kept connecting, waited half a minute each time, and no longer listed the TV as a remote. Both changes are taken out. The announcement and the handling of silent connections are again exactly those of beta.30.
- What was learned stays for later work: the tag is right, and a phone that recognises the device keeps one connection open and tells it when something changes. That is how a real Apple TV is treated, and it is the way to a remote without the short "Can't Connect" message, once it is known what the phone waits for.

**بالعربية**

نسخة تجريبية على قناة «beta». ترجع إلى سلوك beta.30 الذي كان يعمل في كل مرة تقريبًا:

- **التلفزيون يعود إلى قائمة الريموت في الجوال.** beta.31 أعلنت وسمًا يجعل الجوال المقترن يعرف البديل جهازًا له، وbeta.32 تركت اتصالات هذا الجوال مفتوحة. الجوالان عرفاه فعلًا، لكنهما صارا ينتظران منه أكثر مما يستطيع البديل الردّ عليه حتى الآن: بقيا يتصلان وينتظران نصف دقيقة في كل مرة، ولم يعودا يعرضان التلفزيون ريموتًا. أُزيل التغييران. والإعلان ومعاملة الاتصالات الساكتة عادا تمامًا كما في beta.30.
- ما عُرف يبقى لعمل لاحق: الوسم صحيح، والجوال الذي يعرف الجهاز يبقي اتصالًا واحدًا مفتوحًا ويخبره حين يتغيّر شيء. هكذا يُعامل تلفزيون Apple الحقيقي، وهذا هو الطريق إلى ريموت دون رسالة «Can't Connect» القصيرة، متى عُرف ما الذي ينتظره الجوال.

## 1.4.0-beta.32

Trial version on the "beta" channel. Fixes what beta.31 broke, and keeps what it found:

- **The TV vanished from the phone's remote list in beta.31.** The tag added to the announcement in beta.31 was right: the log shows both phones now recognise the stand-in as their own device and keep a connection of their own open to it, every few seconds, without anyone touching a remote. But the plugin still closed every connection that only introduced itself, as it had done since beta.23 to get around the wait on "Connecting". To a phone that recognises the device, that looks like a device that cannot be reached, and it drops it from the list. Those connections are now left open, and so are a phone's earlier connections when it opens another. One connection may now carry one remote after another; the log says when a remote is opened and closed on it.
- Not yet confirmed: whether the phone now asks for the remote over the connection it keeps, and whether the wait on "Connecting" stays away without the closing.

**بالعربية**

نسخة تجريبية على قناة «beta». تصلح ما أفسدته beta.31 وتحتفظ بما اكتشفته:

- **التلفزيون اختفى من قائمة الريموت في beta.31.** الوسم المضاف إلى الإعلان في beta.31 كان صحيحًا: السجل يُظهر أن الجوالين صارا يعرفان البديل جهازًا لهما ويفتحان اتصالًا خاصًّا به كل بضع ثوانٍ، دون أن يلمس أحد الريموت. لكن الإضافة بقيت تغلق كل اتصال اكتفى بالتعريف بنفسه، كما تفعل منذ beta.23 للالتفاف على انتظار «Connecting». وعند جوال يعرف الجهاز، هذا يشبه جهازًا يتعذر الوصول إليه، فيحذفه من القائمة. الآن تُترك هذه الاتصالات مفتوحة، وكذلك اتصالات الجوال السابقة حين يفتح اتصالًا آخر. والاتصال الواحد قد يحمل الآن ريموتًا بعد آخر؛ والسجل يذكر متى فُتح الريموت عليه ومتى أُغلق.
- لم يتأكد بعد: هل يطلب الجوال الريموت الآن عبر الاتصال الذي يبقيه، وهل يبقى انتظار «Connecting» غائبًا دون الإغلاق.

## 1.4.0-beta.31

Trial version on the "beta" channel. Same as beta.30, plus a trial for the cause of the silent connections:

- **iPhone remote: the announcement now carries a tag the paired phone can check.** The log of beta.30 shows that a connection that stays silent and one that opens the remote introduce themselves in exactly the same way, so the difference is on the phone's side. An Apple device announces itself with a short tag worked out from a key it hands over at pairing; a paired phone recognises its own device from the announcement alone. The stand-in handed over such a key but announced a tag that had nothing to do with it, so a phone could only find out who it was by connecting: that may be the silent connection. The tag is now worked out from that key (SipHash-2-4, as other open projects describe for Apple's pairing). The exact byte order Apple uses here is not published; if this trial changes nothing, the other order is next. Not yet confirmed.

**بالعربية**

نسخة تجريبية على قناة «beta». مثل beta.30، ومعها تجربة لسبب الاتصالات الساكتة:

- **ريموت الآيفون: الإعلان يحمل الآن وسمًا يستطيع الجوال المقترن التحقق منه.** سجل beta.30 يُظهر أن الاتصال الساكت والاتصال الذي يفتح الريموت يعرّفان بنفسيهما بالطريقة نفسها تمامًا، فالفرق عند الجوال. جهاز Apple يعلن عن نفسه بوسم قصير محسوب من مفتاح يسلّمه عند الاقتران؛ والجوال المقترن يعرف جهازه من الإعلان وحده. البديل كان يسلّم مفتاحًا كهذا لكنه يعلن وسمًا لا علاقة له به، فلم يكن للجوال طريق لمعرفة من هو إلا بالاتصال: وقد يكون هذا هو الاتصال الساكت. الآن يُحسب الوسم من ذلك المفتاح (SipHash-2-4، كما تصفه مشاريع مفتوحة أخرى لاقتران Apple). ترتيب البايتات الذي تستخدمه Apple هنا غير منشور؛ فإن لم تغيّر هذه التجربة شيئًا فالترتيب الآخر هو التالي. لم يتأكد بعد.

## 1.4.0-beta.30

Trial version on the "beta" channel. Behaves as beta.29; only the log changes, to find the cause of what is left:

- **iPhone remote: why some connections stay silent.** With beta.29 the message "Can't Connect to Apple TV" appeared once or twice in about twenty opens: after a silent connection was closed, the phone usually tried again at once, but twice it did not. To tell a connection that opens the remote from one that stays silent, the log now writes, for both, the switches the phone sends about itself (plain numbers such as its status flags, never an identifier or a name) in place of the long list of field names.

**بالعربية**

نسخة تجريبية على قناة «beta». تعمل مثل beta.29؛ التغيير في السجل فقط، لمعرفة سبب ما بقي:

- **ريموت الآيفون: لماذا تبقى بعض الاتصالات ساكتة.** مع beta.29 ظهرت رسالة «Can't Connect to Apple TV» مرة أو مرتين في نحو عشرين فتحًا: بعد إغلاق الاتصال الساكت كان الجوال يحاول فورًا في الغالب، لكنه لم يفعل مرتين. وللتفريق بين الاتصال الذي يفتح الريموت والذي يبقى ساكتًا، صار السجل يكتب للاثنين المفاتيح التي يرسلها الجوال عن نفسه (أرقام عادية مثل أعلام حالته، دون أي معرّف أو اسم) بدل قائمة أسماء الحقول الطويلة.

## 1.4.0-beta.29

Trial version on the "beta" channel. Same as beta.28, plus what its log showed:

- **iPhone remote: "Can't Connect to Apple TV" still flashes.** Naming the stand-in with its announced identifiers (beta.28) did not stop the phone from opening a silent connection first. The log shows that a remote that opens asks for its session within a few hundredths of a second, so the first silent connection is now closed after 0.15 seconds instead of 0.4, and the phone's second try comes that much sooner. One that keeps coming straight back is given more time each round (0.15, 0.15, 0.3, then 1 second). Whether the message disappears is not yet confirmed; why the phone opens a silent connection at all is still unknown.

**بالعربية**

نسخة تجريبية على قناة «beta». مثل beta.28، ومعها ما أظهره سجلها:

- **ريموت الآيفون: رسالة «Can't Connect to Apple TV» ما زالت تومض.** تعريف البديل بمعرّفاته المعلنة (beta.28) لم يمنع الجوال من فتح اتصال ساكت أولًا. السجل يُظهر أن الريموت الذي يفتح يطلب جلسته خلال أجزاء قليلة من مئة من الثانية، فصار أول اتصال ساكت يُغلق بعد 0.15 ثانية بدل 0.4، وتأتي محاولة الجوال الثانية أسرع بهذا القدر. والاتصال الذي يعود فورًا مرة بعد مرة يُعطى وقتًا أطول في كل جولة (0.15 ثم 0.15 ثم 0.3 ثم ثانية). لم يتأكد بعد هل تختفي الرسالة؛ وسبب فتح الجوال اتصالًا ساكتًا من الأساس ما زال مجهولًا.

## 1.4.0-beta.28

Trial version on the "beta" channel. Same as beta.27, plus what its log showed:

- **iPhone remote: "Can't Connect to Apple TV" for a second.** The half-minute waits are gone in the log of beta.27. What is left is a short message on the phone: it appears when the plugin closes a silent connection and the phone tries again. Two changes. The silent connection is closed after four tenths of a second instead of one, so the second try comes sooner. And, as a trial for the cause itself: the stand-in now names itself to the phone with the same identifiers it announces on the network; until now one of them differed, and a phone that connects by itself has only those to tell which device answered. Not yet confirmed.

**بالعربية**

نسخة تجريبية على قناة «beta». مثل beta.27، ومعها ما أظهره سجلها:

- **ريموت الآيفون: «Can't Connect to Apple TV» لمدة ثانية.** انتظارات نصف الدقيقة اختفت في سجل beta.27. الباقي رسالة قصيرة على الجوال: تظهر حين تغلق الإضافة اتصالًا ساكتًا ثم يحاول الجوال من جديد. تغييران. الاتصال الساكت يُغلق بعد أربعة أعشار الثانية بدل ثانية، فتأتي المحاولة الثانية أسرع. وتجربة لأصل السبب: البديل يعرّف بنفسه للجوال بالمعرّفات نفسها التي يعلنها على الشبكة؛ وكان أحدها مختلفًا حتى الآن، والجوال الذي يتصل من نفسه يملك هذه المعرّفات فقط ليعرف أي جهاز أجابه. لم يتأكد بعد.

## 1.4.0-beta.27

Trial version on the "beta" channel. Same as beta.26, plus what its log showed:

- **iPhone remote stuck on "Connecting": the last half-minute waits.** With beta.26 a silent connection is closed after one second and the remote then opens at once. Every half-minute wait left in the log came from one kind of connection: the phone introduced itself in another wording, the plugin read the request's name one place off, did not recognise it, and so neither answered nor closed it. The request is now recognised by its name wherever it was read, answered, and treated like the others.
- **Log: only field names.** In that case the log line listing field names could include an identifier of the phone. Anything that does not look like one of Apple's field names is now written as "(other)".

**بالعربية**

نسخة تجريبية على قناة «beta». مثل beta.26، ومعها ما أظهره سجلها:

- **ريموت الآيفون يعلق على «Connecting»: آخر انتظارات نصف الدقيقة.** مع beta.26 يُغلق الاتصال الساكت بعد ثانية ثم يفتح الريموت فورًا. كل انتظار نصف دقيقة بقي في السجل جاء من نوع واحد من الاتصالات: الجوال عرّف بنفسه بصياغة أخرى، فقرأت الإضافة اسم الطلب في غير موضعه ولم تتعرف عليه، فلم تردّ عليه ولم تغلقه. الآن يُعرف الطلب من اسمه أينما قُرئ، ويُردّ عليه، ويُعامل مثل غيره.
- **السجل: أسماء الحقول فقط.** في تلك الحالة كان سطر أسماء الحقول قد يحمل معرّفًا للجوال. الآن يُكتب «(other)» مكان كل ما لا يشبه أسماء حقول Apple.

## 1.4.0-beta.26

Trial version on the "beta" channel. Same as beta.25, plus:

- **The pairing code is shown under the chosen remote.** Choosing "Remote like Apple TV" (or both) now shows the code right there, with a note that it can be changed further down. It follows what is typed in the code field.
- **iPhone remote stuck on "Connecting": the silent connection is closed sooner and every time.** The log of beta.25 shows that saying whether the TV is awake changed nothing, and that every half-minute wait left came from a silent connection the plugin had stopped closing after four closes. A remote that opens asks for its session within a twentieth of a second, so the silent connection is now closed after one second instead of three, and up to thirty times in two minutes instead of four.

**بالعربية**

نسخة تجريبية على قناة «beta». مثل beta.25، ومعها:

- **رمز الاقتران يظهر تحت الريموت المختار.** عند اختيار «ريموت مثل Apple TV» (أو الاثنين معًا) يظهر الرمز في مكانه، مع ملاحظة أن تغييره في الأسفل. ويتبع ما يُكتب في خانة الرمز.
- **ريموت الآيفون يعلق على «Connecting»: إغلاق الاتصال الساكت أسرع وفي كل مرة.** سجل beta.25 يُظهر أن إخبار الجوال بأن التلفزيون مستيقظ لم يغيّر شيئًا، وأن كل انتظار نصف دقيقة بقي كان من اتصال ساكت توقفت الإضافة عن إغلاقه بعد أربع مرات. الريموت الذي يفتح يطلب جلسته خلال جزء من عشرين من الثانية، فصار الاتصال الساكت يُغلق بعد ثانية واحدة بدل ثلاث، وحتى ثلاثين مرة في دقيقتين بدل أربع.

## 1.4.0-beta.25

Trial version on the "beta" channel. Same as beta.24, plus what its log showed:

- **iPhone remote stuck on "Connecting": the stand-in now says whether the TV is awake.** The log of beta.24 shows that a stuck connection sends one message only, its introduction, and then waits half a minute; nothing was dropped unread. So the phone is waiting to hear something. An Apple TV tells a phone that introduced itself whether it is awake; the stand-in said so only when asked. It now says it straight after the introduction. A trial: not yet confirmed as the cure.
- **The log names the fields** (Apple's field names, never their values) of a first message that came without a request name, seen from one device in beta.24.

**بالعربية**

نسخة تجريبية على قناة «beta». مثل beta.24، ومعها ما أظهره سجلها:

- **ريموت الآيفون يعلق على «Connecting»: البديل يخبر الآن هل التلفزيون مستيقظ.** سجل beta.24 يُظهر أن الاتصال العالق يرسل رسالة واحدة فقط، هي تعريفه بنفسه، ثم ينتظر نصف دقيقة؛ ولم تُهمل أي رسالة دون قراءة. إذن الجوال ينتظر أن يسمع شيئًا. تلفزيون Apple يخبر الجوال الذي عرّف بنفسه هل هو مستيقظ؛ والبديل كان يخبر بذلك عند السؤال فقط. الآن يخبر به مباشرة بعد التعريف. تجربة: لم يتأكد بعد أنها العلاج.
- **السجل يذكر أسماء الحقول** (أسماء Apple، دون قيمها) لرسالة أولى وصلت دون اسم طلب، ظهرت من جهاز واحد في beta.24.

## 1.4.0-beta.24

Trial version on the "beta" channel. Same as beta.23, plus what its log showed:

- **iPhone remote stuck on "Connecting": looking at what the silent connection sends.** Closing the silent connection (beta.23) made the phone try again, and it then connected only after several tries. The half-minute wait looks like the phone waiting for an answer to something this plugin did not answer. Until now a message the plugin could not read was dropped without a word. Now it is written in the log (its kind, size and reason, never its content), and a connection that left without opening the remote says how many messages of each kind arrived and when the last one came.
- **One value Apple uses (minus one) was refused** by the reader of the phone's messages, which dropped the whole message. It is now read.

**بالعربية**

نسخة تجريبية على قناة «beta». مثل beta.23، ومعها ما أظهره سجلها:

- **ريموت الآيفون يعلق على «Connecting»: فحص ما يرسله الاتصال الساكت.** إغلاق الاتصال الساكت (beta.23) جعل الجوال يحاول من جديد، لكنه لم يتصل إلا بعد عدة محاولات. انتظار نصف الدقيقة يشبه انتظار الجوال ردًّا على شيء لم تردّ عليه الإضافة. حتى الآن كانت الرسالة التي لم تستطع الإضافة قراءتها تُهمل بصمت. الآن تُكتب في السجل (نوعها وحجمها والسبب، دون محتواها)، والاتصال الذي غادر دون فتح الريموت يذكر عدد الرسائل الواردة من كل نوع ومتى وصلت آخرها.
- **قيمة تستخدمها Apple (سالب واحد) كان قارئ رسائل الجوال يرفضها** فيُهمل الرسالة كلها. الآن تُقرأ.

## 1.4.0-beta.23

Trial version on the "beta" channel. Same as beta.22, plus what its log showed:

- **iPhone remote stuck on "Connecting": the idle connection is closed.** Naming itself (beta.22) changed nothing. The log shows that some seconds after a remote is closed, the phone connects again by itself, says who it is, and then says nothing for half a minute; an opened remote asks for its session within a moment. Such a silent connection is now closed after three seconds, unless that makes the phone come straight back again and again. Not yet confirmed as the cure.
- **The log tells the devices apart**: "device 1", "device 2", in the order they were paired, never a name. It also notes a device that connected and left without proving itself, and where it stopped.

**بالعربية**

نسخة تجريبية على قناة «beta». مثل beta.22، ومعها ما أظهره سجلها:

- **ريموت الآيفون يعلق على «Connecting»: إغلاق الاتصال الخامل.** تعريف البديل بنفسه (beta.22) لم يغيّر شيئًا. السجل يُظهر أن الجوال يتصل من نفسه بعد ثوانٍ من إغلاق الريموت، يعرّف بنفسه، ثم يسكت نصف دقيقة؛ أما الريموت المفتوح فيطلب جلسته في لحظة. الآن يُغلق هذا الاتصال الساكت بعد ثلاث ثوانٍ، إلا إذا جعل ذلك الجوال يعود مرة بعد مرة. لم يتأكد بعد أنه العلاج.
- **السجل يميّز بين الأجهزة**: «device 1» و«device 2» بترتيب اقترانها، دون أي اسم. ويذكر أيضًا الجهاز الذي اتصل وغادر دون أن يثبت هويته، وأين توقف.

## 1.4.0-beta.22

Trial version on the "beta" channel. Same as beta.21, plus what its log showed:

- **iPhone remote stuck on "Connecting": another attempt.** The log ruled out the earlier idea: no older connection was open when the phone got stuck. What it showed is a phone that connects, proves itself, tells the stand-in who it is, and then waits half a minute. The stand-in used to answer that with nothing; it now names itself in return, as it does when pairing. Not yet confirmed as the cure. The log now also says what a phone asked before the remote opened, and the names (never the values) of what it sent about itself, to compare a connection that works with one that waits.
- **A field opened again.** On a real TV its report of the text already there did not arrive within the short wait. It is now also taken when it comes later, as long as nothing was typed yet, and the log says after how many milliseconds it came.

**بالعربية**

نسخة تجريبية على قناة «beta». مثل beta.21، ومعها ما أظهره سجلها:

- **ريموت الآيفون يعلق على «Connecting»: محاولة أخرى.** السجل نفى الفكرة السابقة: لم يكن هناك اتصال أقدم مفتوح حين علق الجوال. وما أظهره هو جوال يتصل، ويثبت هويته، ويعرّف بنفسه، ثم ينتظر نصف دقيقة. كان البديل يرد على ذلك برد فارغ؛ والآن يعرّف بنفسه في المقابل، كما يفعل عند الاقتران. لم يتأكد بعد أنه العلاج. والسجل يذكر الآن أيضًا ما طلبه الجوال قبل فتح الريموت، وأسماء ما أرسله عن نفسه (دون قيمها)، لمقارنة اتصال يعمل باتصال ينتظر.
- **خانة تُفتح من جديد.** على تلفزيون حقيقي لم يصل بلاغه عن النص الموجود خلال الانتظار القصير. الآن يؤخذ أيضًا إذا وصل متأخرًا ما دام لم يُكتب شيء بعد، والسجل يذكر بعد كم جزء من الثانية وصل.

## 1.4.0-beta.21

Trial version on the "beta" channel. Same as beta.20, with two points from a review:

- **A field opened again.** The plugin started every field empty, so on a field that still held text a backspace on the iPhone removed nothing. The TV says what the field holds right as its keyboard opens; the iPhone keyboard now starts from that text. The text is kept in memory only and never written to the log, which gives its length.
- **Closing an earlier connection, more carefully.** beta.19 closed every earlier connection of a phone that came back. A phone may also open a second connection only to ask something, and that must never cut the remote in use. Now only an earlier connection without an open remote is closed, and the log says how many of each kind there were.

**بالعربية**

نسخة تجريبية على قناة «beta». مثل beta.20، مع نقطتين من مراجعة:

- **خانة تُفتح من جديد.** كانت الإضافة تبدأ كل خانة فارغة، فإذا بقي في الخانة نص لم يحذف زر الحذف على الآيفون شيئًا. التلفزيون يذكر ما في الخانة لحظة فتح كيبورده؛ والآن يبدأ كيبورد الآيفون من ذلك النص. يبقى النص في الذاكرة فقط ولا يُكتب في السجل، والسجل يذكر طوله.
- **إغلاق الاتصال السابق بحذر أكبر.** كانت beta.19 تغلق كل اتصال سابق للجوال العائد. وقد يفتح الجوال اتصالًا ثانيًا ليسأل شيئًا فقط، ويجب ألا يقطع ذلك الريموت المستخدم. الآن يُغلق الاتصال السابق الذي ليس فيه ريموت مفتوح فقط، والسجل يذكر عدد كل نوع.

## 1.4.0-beta.20

Trial version on the "beta" channel. Same as beta.19, plus:

- **Settings: the switch list opens only when wanted.** Card 2 now has one tick, "I want switches for automations". The list of switches shows only when it is ticked; without it the TV has no switches.

**بالعربية**

نسخة تجريبية على قناة «beta». مثل beta.19، ومعها:

- **الإعدادات: قائمة المفاتيح تفتح عند الطلب فقط.** في البطاقة 2 علامة واحدة «أريد مفاتيح للأتمتة». تظهر قائمة المفاتيح حين تُعلَّم فقط؛ ومن دونها لا يكون للتلفزيون مفاتيح.

## 1.4.0-beta.19

Trial version on the "beta" channel. Same as beta.18, plus:

- **The remote and the switches are two separate choices.** Card 1 is the remote on the iPhone: like Apple TV (recommended), the TV tile with the Home remote, both together (not recommended), or none. Card 2 is "Switches for automations": tick the ones you want, none to begin with. They work with any remote, so a TV tile can now have switches too.
- **More switches to choose from**: power, mute, volume up and down, channel up and down, play or pause, and the TV's home screen. They show in Apple Home as one group for the TV. The momentary ones go off again by themselves, so an automation can press one several times. A switch that is no longer ticked leaves Apple Home.
- Settings from before keep what they had: "switches" still means power, mute and volume.
- **iPhone remote stuck on "Connecting" when opened again.** The log of a real phone showed it: the phone came back on a new connection, asked one thing, and waited half a minute. When the same phone comes back, its earlier connection is now closed. Not yet confirmed as the cure; the log now also says when a remote connection ends.

**بالعربية**

نسخة تجريبية على قناة «beta». مثل beta.18، ومعها:

- **الريموت والمفاتيح اختياران منفصلان.** البطاقة 1 هي الريموت على الآيفون: مثل Apple TV (موصى به)، أو بطاقة تلفزيون مع ريموت تطبيق المنزل، أو الاثنان معًا (لا نوصي به)، أو دون ريموت. والبطاقة 2 «مفاتيح للأتمتة»: تعلّم ما تريده منها، والأصل أنها غير معلّمة. تعمل مع أي ريموت، فصارت بطاقة التلفزيون تقبل المفاتيح أيضًا.
- **مفاتيح أكثر للاختيار**: التشغيل، الكتم، رفع الصوت وخفضه، القناة التالية والسابقة، تشغيل أو إيقاف مؤقت، والشاشة الرئيسية للتلفزيون. تظهر في Apple Home مجموعة واحدة للتلفزيون. ومفاتيح الضغطة الواحدة تعود مطفأة وحدها، فتستطيع الأتمتة ضغطها عدة مرات. والمفتاح الذي تُزال علامته يخرج من Apple Home.
- الإعدادات السابقة تحتفظ بما كان لها: «مفاتيح» ما زالت تعني التشغيل والكتم والصوت.
- **ريموت الآيفون يعلق على «Connecting» عند فتحه مرة ثانية.** أظهره سجل جوال حقيقي: عاد الجوال باتصال جديد، وطلب شيئًا واحدًا، وانتظر نصف دقيقة. الآن حين يعود الجوال نفسه يُغلق اتصاله السابق. لم يتأكد بعد أنه العلاج؛ والسجل يذكر الآن أيضًا متى ينتهي اتصال الريموت.

## 1.4.0-beta.18

Trial version on the "beta" channel. Same as beta.17, plus:

- **Settings: one question for the TV.** "How do you want this TV on the iPhone?" has four whole set-ups, so no two choices can disagree: a remote like Apple TV (marked recommended), the TV tile with the Home remote, both together (marked not recommended: two names for one TV, and inputs can be reached with the remote like Apple TV as well), or switches only.

**بالعربية**

نسخة تجريبية على قناة «beta». مثل beta.17، ومعها:

- **الإعدادات: سؤال واحد للتلفزيون.** «كيف تريد هذا التلفزيون على الآيفون؟» له أربعة إعدادات كاملة، فلا يتعارض خياران: ريموت مثل Apple TV (موصى به)، أو بطاقة تلفزيون مع ريموت تطبيق المنزل، أو الاثنان معًا (لا نوصي به: اسمان لتلفزيون واحد، والمداخل تصلها بالريموت الذي مثل Apple TV أيضًا)، أو مفاتيح فقط.

## 1.4.0-beta.17

Trial version on the "beta" channel. Same as beta.16, plus:

- **Settings: the two TV choices can no longer disagree.** The second question is now only "Do you want the remote with keyboard?", yes or no, and what each answer means follows the first choice: beside a TV tile it is a second remote, with switches it is the only one. Before, "switches" above could be combined with "Home remote" below, which does not exist without a tile.

**بالعربية**

نسخة تجريبية على قناة «beta». مثل beta.16، ومعها:

- **الإعدادات: خيارا التلفزيون لا يتعارضان بعد الآن.** السؤال الثاني صار «هل تريد الريموت الذي فيه كيبورد؟» بنعم أو لا، ومعنى كل جواب يتبع الخيار الأول: مع بطاقة التلفزيون هو ريموت ثانٍ، ومع المفاتيح هو الريموت الوحيد. قبل ذلك كان يمكن الجمع بين «مفاتيح» في الأعلى و«ريموت تطبيق المنزل» في الأسفل، وهو غير موجود دون بطاقة.

## 1.4.0-beta.16

Trial version on the "beta" channel. Same as beta.15, with the typing corrected by a further log of a real iPhone:

- **The message after a key press is a picture of the whole text.** After a letter it is one longer, after a deletion one shorter, and after an accepted suggestion it holds the suggested word. The field now follows it: the picture replaces the field. beta.15 left it out, which kept plain typing right but lost an accepted suggestion and text typed with the cursor moved. A phone that never sends keyboard state is handled as before.

**بالعربية**

نسخة تجريبية على قناة «beta». مثل beta.15، مع تصحيح الكتابة بسجل آخر من آيفون حقيقي:

- **الرسالة التي تلي الضغطة صورة للنص كله.** بعد حرف تزيد واحدًا، وبعد حذف تنقص واحدًا، وبعد قبول اقتراح تحمل الكلمة المقترحة. الآن تتبعها الخانة: الصورة تحل محل الخانة. كانت beta.15 تتركها، فتصح الكتابة العادية ويضيع الاقتراح المقبول والنص المكتوب والمؤشر في غير آخره. والجوال الذي لا يرسل حالة الكيبورد أبدًا يُعامل كما كان.

## 1.4.0-beta.15

Trial version on the "beta" channel. Same as beta.14, plus what the log of a real iPhone showed:

- **Typing, by what the message is.** A keystroke carries the keyboard's own state and one letter. The message after it carries no keyboard state, and as text everything inserted since the keyboard opened, deletions not taken out. It is now left out for being that kind of message, right after a keystroke, and no longer by timing or by comparing it with the field. This also covers typing again after deleting everything, where beta.13 still multiplied the text.
- **TV tile port.** In beta.13 only one of several TVs kept its port, because the TVs wrote the list at the same moment. Each one's port is now kept.
- **iPhone remote that hangs when opened again.** Every session now gets a number of its own. Not yet confirmed as the cause.

**بالعربية**

نسخة تجريبية على قناة «beta». مثل beta.14، ومعها ما أظهره سجل آيفون حقيقي:

- **الكتابة، بحسب نوع الرسالة.** الضغطة تحمل حالة الكيبورد نفسه وحرفًا واحدًا. والرسالة التي تليها لا تحمل حالة الكيبورد، ونصها كل ما أُدخل منذ فتح الكيبورد دون طرح المحذوف. الآن تُترك لأنها من هذا النوع وتأتي بعد ضغطة مباشرة، وليس بالتوقيت أو بمقارنتها بالخانة. وهذا يشمل الكتابة من جديد بعد حذف كل شيء، وهي الحالة التي بقي النص يتضاعف فيها في beta.13.
- **منفذ بطاقة التلفزيون.** في beta.13 احتفظ تلفزيون واحد فقط بمنفذه، لأن التلفزيونات كتبت القائمة في اللحظة نفسها. الآن يُحفظ منفذ كل واحد.
- **ريموت الآيفون يعلق عند فتحه مرة ثانية.** كل جلسة تأخذ الآن رقمًا خاصًا بها. لم يتأكد بعد أنه السبب.

## 1.4.0-beta.14

Trial version on the "beta" channel. Same as beta.13, plus:

- **iPhone remote stuck on "Connecting".** The remote was announced on every network address of the machine, including the inner networks of a container, which a phone cannot reach. It is now announced only on the real network interfaces. Not yet confirmed as the cause; when a phone connects and leaves without opening the remote, the log now also names what it asked for.
- **Typing repeated now and then.** A repeated word is still left out when it comes late, and when it is the first thing a phone says after it reconnects in the middle of a field.

**بالعربية**

نسخة تجريبية على قناة «beta». مثل beta.13، ومعها:

- **ريموت الآيفون يعلق على «Connecting».** كان الريموت يُعلَن على كل عناوين الجهاز، ومنها الشبكات الداخلية للحاوية التي لا يصلها الجوال. الآن يُعلَن على واجهات الشبكة الحقيقية فقط. لم يتأكد بعد أنه السبب؛ وحين يتصل جوال ويغادر دون فتح الريموت يذكر السجل الآن ما طلبه.
- **تكرار الكتابة أحيانًا.** الكلمة المكررة تُترك أيضًا حين تصل متأخرة، وحين تكون أول ما يقوله الجوال بعد إعادة اتصاله وسط الخانة.

## 1.4.0-beta.13

Trial version on the "beta" channel. Same as beta.12, plus:

- **The Home remote of a TV tile that answers only sometimes.** Homebridge gave each TV tile a new network port at every start, so a phone had to find the tile again after each restart. The tile now keeps one port, remembered by the plugin, with nothing to set by hand. A port range set in Homebridge still wins. Whether this was the cause on a real home is not yet confirmed.

**بالعربية**

نسخة تجريبية على قناة «beta». مثل beta.12، ومعها:

- **ريموت تطبيق المنزل لبطاقة التلفزيون الذي يستجيب أحيانًا فقط.** كان Homebridge يعطي كل بطاقة تلفزيون منفذ شبكة جديدًا عند كل تشغيل، فيبحث الجوال عن البطاقة من جديد بعد كل إعادة تشغيل. الآن تحتفظ البطاقة بمنفذ واحد تحفظه الإضافة، دون أي إعداد يدوي. وإن حُدد مدى منافذ في Homebridge فهو المعتمد. لم يتأكد بعد أن هذا هو السبب في منزل حقيقي.

## 1.4.0-beta.12

Trial version on the "beta" channel. Same as beta.11, plus:

- **Groundwork for a fix that rests on meaning, after a review.** For each kind of edit a real iPhone sends, the log now gives, once, the names of the fields the phone filled in (Apple's field names only, never their values). With them the repeated word can be told apart by what the message is, rather than by its timing and by the field already ending with it, as beta.11 does.

**بالعربية**

نسخة تجريبية على قناة «beta». مثل beta.11، ومعها:

- **تمهيد لإصلاح مبني على المعنى، بعد مراجعة.** لكل نوع من التعديلات التي يرسلها آيفون حقيقي يذكر السجل الآن، مرة واحدة، أسماء الحقول التي ملأها الجوال (أسماء حقول Apple فقط، ولا تُكتب قيمها أبدًا). بها تُميَّز الكلمة المكررة بنوع الرسالة نفسه، بدل توقيتها وانتهاء الخانة بها كما تفعل beta.11.

## 1.4.0-beta.11

Trial version on the "beta" channel. Same as beta.10, plus:

- **Doubled letters: the cause, read from the log of a real iPhone.** The iPhone says every keystroke twice: first the one letter (or the one removal), then at once the whole word as it now stands. The plugin added both. The second message is now left out, since the field already ends with it. The guess of beta.10 was wrong and is removed. Not yet confirmed on a real TV.
- **Settings.** "How it appears in Apple Home" and "iPhone remote with keyboard" are each in a frame with a coloured title, and the chosen card is marked.

**بالعربية**

نسخة تجريبية على قناة «beta». مثل beta.10، ومعها:

- **تكرار الحروف: السبب، مقروءًا من سجل آيفون حقيقي.** الآيفون يقول كل ضغطة مرتين: الحرف الواحد أولًا (أو الحذف الواحد)، ثم في الحال الكلمة كلها كما صارت. وكانت الإضافة تضيف الاثنين. الآن تُترك الرسالة الثانية، لأن الخانة تنتهي بها أصلًا. تخمين beta.10 كان خاطئًا وحُذف. لم يتأكد بعد على تلفزيون حقيقي.
- **الإعدادات.** قسم «كيف يظهر في Apple Home» وقسم «ريموت الآيفون مع الكيبورد» صار كل منهما في إطار له عنوان ملوّن، والبطاقة المختارة مميّزة.

## 1.4.0-beta.10

Trial version on the "beta" channel. Same as beta.9, plus:

- **Doubled letters, second attempt.** A trial showed that the TV replaces its field correctly, so the doubling comes from how the iPhone words its typing: it appears to send the whole word with every letter, and once more when the word is settled. Once the plugin sees that, the word replaces its own beginning instead of being added again. Not yet confirmed on a real iPhone; the log lines of beta.9 stay to show it.

**بالعربية**

نسخة تجريبية على قناة «beta». مثل beta.9، ومعها:

- **تكرار الحروف، المحاولة الثانية.** أظهرت تجربة أن التلفزيون يستبدل خانته صحيحًا، فالتكرار يأتي من طريقة الآيفون في إرسال الكتابة: يبدو أنه يرسل الكلمة كلها مع كل حرف، ومرة أخرى حين تستقر الكلمة. حين ترى الإضافة ذلك تضع الكلمة مكان بدايتها بدل أن تضيفها من جديد. لم يتأكد بعد على آيفون حقيقي؛ وأسطر السجل من beta.9 باقية لتبيّنه.

## 1.4.0-beta.9

Trial version on the "beta" channel. Same as beta.8, plus:

- **Clearer choice of remote.** The three choices are now cards with a short line each, and the notes are a short list. The list says that apps with their own keyboard, such as YouTube and Netflix, do not accept typing.
- **Doubled letters are not fixed yet.** To find the cause, the log now gives the shape of each edit a real iPhone sends, in lengths only and never the text.

**بالعربية**

نسخة تجريبية على قناة «beta». مثل beta.8، ومعها:

- **اختيار الريموت أوضح.** الخيارات الثلاثة صارت بطاقات مع سطر قصير لكل منها، والملاحظات قائمة قصيرة تذكر أن التطبيقات التي لها كيبورد خاص، مثل YouTube و Netflix، لا تقبل الكتابة.
- **تكرار الحروف لم يُحل بعد.** لمعرفة السبب يذكر السجل الآن شكل كل تعديل يرسله آيفون حقيقي، بالأطوال فقط ولا يُكتب النص أبدًا.

## 1.4.0-beta.8

Trial version on the "beta" channel. Same as beta.7, with one way to use the touch area, as on an Apple TV:

- **Sliding like Apple TV.** While the finger slides on the touch area, the selection on the TV moves one step for every stretch of the way; a short flick is one step and a tap selects. Before, a whole swipe was only one step.
- **The pointer option of beta.5 is removed**, so the remote behaves one way for everyone.

**بالعربية**

نسخة تجريبية على قناة «beta». مثل beta.7، مع طريقة واحدة للوحة اللمس كما في Apple TV:

- **سحب مثل Apple TV.** ما دام الإصبع يسحب على لوحة اللمس ينتقل التحديد على التلفزيون خطوة لكل مسافة يقطعها؛ والسحبة القصيرة خطوة واحدة واللمسة تختار. قبل ذلك كانت السحبة كلها خطوة واحدة.
- **حُذف خيار المؤشر الذي أضيف في beta.5**، ليعمل الريموت بطريقة واحدة للجميع.

## 1.4.0-beta.7

Trial version on the "beta" channel. Same as beta.6, plus:

- **Choose your remote.** Under the TV's options, "Which remote do you want on the iPhone?" now has three choices: the Home remote of the TV tile; a remote like Apple TV only (keyboard and touch pad, one name, the TV shown in Apple Home as switches); or both. With no tile the remote carries the plain TV name, without "+".

**بالعربية**

نسخة تجريبية على قناة «beta». مثل beta.6، ومعها:

- **اختر ريموتك.** في خيارات التلفزيون، سؤال «أي ريموت تريده على الآيفون؟» له الآن ثلاثة خيارات: ريموت تطبيق المنزل لبطاقة التلفزيون؛ أو ريموت مثل Apple TV فقط (كيبورد ولوحة لمس، باسم واحد، والتلفزيون يظهر في Apple Home كمفاتيح)؛ أو الاثنان. ومن دون البطاقة يحمل الريموت اسم التلفزيون كما هو، دون «+».

## 1.4.0-beta.6

Trial version on the "beta" channel. Same as beta.5, plus:

- **Pairing code of the iPhone remote is 0000.** Every new iPhone or iPad enters it once. Under the TV's options you can set four digits of your own; devices already paired stay paired. Anyone on your network who knows the code can pair, so set your own digits if others use the network.

**بالعربية**

نسخة تجريبية على قناة «beta». مثل beta.5، ومعها:

- **رمز اقتران ريموت الآيفون صار 0000.** كل آيفون أو آيباد جديد يدخله مرة واحدة. وفي خيارات التلفزيون تستطيع وضع أربعة أرقام من اختيارك؛ والأجهزة المقترنة تبقى مقترنة. من يعرف الرمز على شبكتك يستطيع الاقتران، فضع أرقامك إن كان غيرك يستخدم الشبكة.

## 1.4.0-beta.5

Trial version on the "beta" channel. iPhone remote with keyboard, after the first trial on a real TV:

- **Doubled letters.** Before the first text of each keyboard session the TV is now told that text is coming, as the reference libraries do. And what the TV says back about its field is never fed into the typing again; only its length goes to the log. Not yet confirmed on a real TV.
- **Pointer instead of arrows (option).** Under the TV's options, "Touch area of the remote" can be set to "Pointer": the finger moves the TV's pointer and a tap clicks. A tap with no pointer on screen is still the OK key. Not yet tried on a real TV.
- **Slow or failed opening of the remote.** The log now says how long the phone took to prove itself and how long until the remote was ready, when a phone left without opening the remote, and the name of any request the plugin does not answer. Never any content.
- When a field closes, the log also gives the length of the last text sent and the length the TV last reported.

**بالعربية**

نسخة تجريبية على قناة «beta». ريموت الآيفون مع الكيبورد، بعد أول تجربة على تلفزيون حقيقي:

- **تكرار الحروف.** قبل أول نص في كل جلسة كيبورد تُبلَّغ الشاشة أن نصًا قادم، كما تفعل المكتبات المرجعية. وما تردّه الشاشة عن خانتها لا يعود إلى الكتابة أبدًا؛ طوله فقط يُكتب في السجل. لم يتأكد بعد على تلفزيون حقيقي.
- **مؤشر بدل الأسهم (خيار).** في خيارات التلفزيون، «منطقة اللمس في الريموت» تقبل «مؤشر»: الإصبع يحرك مؤشر التلفزيون واللمسة تنقر. واللمسة حين لا يظهر مؤشر تبقى زر «موافق». لم يُجرَّب بعد على تلفزيون حقيقي.
- **بطء فتح الريموت أو فشله.** السجل يذكر الآن كم استغرق الجوال ليثبت هويته وكم مضى حتى جهز الريموت، ومتى غادر جوال دون فتح الريموت، واسم أي طلب لا تجيب عنه الإضافة. ولا يُكتب أي محتوى.
- عند إغلاق الخانة يذكر السجل طول آخر نص أُرسل والطول الذي ذكرته الشاشة آخر مرة.

## 1.4.0-beta.4

Trial version on the "beta" channel. Same as beta.3, plus what is new in 1.3.4: the log says where a failed connection stopped, and the plugin waits five seconds after start before asking the first appliance.

**بالعربية**

نسخة تجريبية على قناة «beta». مثل beta.3، ومعها جديد 1.3.4: السجل يذكر أين توقف الاتصال الفاشل، والإضافة تنتظر خمس ثوانٍ بعد البدء قبل طلب أول جهاز.

## 1.4.0-beta.3

Trial version on the "beta" channel. Same as beta.2, plus the two fixes of 1.3.3: appliances connect one after another at start, and a second on/off signal for TVs that do not name their power state.

**بالعربية**

نسخة تجريبية على قناة «beta». مثل beta.2، ومعها إصلاحا 1.3.3: الاتصال بالأجهزة واحدًا بعد الآخر عند البدء، وإشارة ثانية لحالة التلفزيونات التي لا تذكر حالة تشغيلها.

## 1.4.0-beta.2

Trial version on the "beta" channel. iPhone remote with keyboard, after a review of beta.1:

- Typing that was still on its way when a field closed is dropped, and never reaches the next field.
- When a TV says what an opened field already holds, typing continues from that text.
- The log now gives three separate facts for each field: the TV opened its keyboard, how many remotes were asked to show the iPhone keyboard, and how many times typed text was sent to the TV (never the text itself). A trial then shows where the path stops.

Still not tried with a real iPhone or a real TV. Whether a TV replaces or appends sent text can only be seen on its screen.

**بالعربية**

نسخة تجريبية على قناة «beta». ريموت الآيفون مع الكيبورد، بعد مراجعة beta.1:

- الكتابة التي كانت في طريقها حين أُغلقت الخانة تُسقط، ولا تصل إلى الخانة التالية.
- حين يُبلغ التلفزيون بما تحتويه الخانة المفتوحة، تُستكمل الكتابة من ذلك النص.
- السجل يعطي ثلاث حقائق منفصلة لكل خانة: فتح التلفزيون للكيبورد، وعدد الريموتات التي طُلب منها إظهار كيبورد الآيفون، وعدد مرات إرسال النص إلى التلفزيون (دون النص نفسه). فتُظهر التجربة أين يتوقف المسار.

لم تُجرَّب بعد مع آيفون حقيقي ولا تلفزيون حقيقي. وهل يستبدل التلفزيون النص المرسل أم يُلحقه، هذا يُرى على شاشته فقط.

## 1.4.0-beta.1

Trial version, published on the "beta" channel only. Stable installs stay on 1.3.2.

Typing on a Samsung TV from the iPhone's own remote.

- **New option per TV: "iPhone remote with keyboard (trial)".** The TV is shown to the remote in Control Centre as an Apple TV, under its name followed by "+". Pair it once with the four-digit code shown in the TV's options. Its buttons, swipes, volume and power then reach the TV, and when the TV opens a text field the iPhone keyboard opens and what is typed appears on the TV.
- Your TV tile in Apple Home, its pairing and the TV's own approval stay untouched. The option adds a second name in the remote list.
- It works inside this plugin, with nothing else to install, and stays on your home network.
- Everything it keeps is one file in the plugin folder (`apple-remote.json`). Switching the option off removes it; going back to 1.3.2 leaves nothing in the system.
- The log says when a TV opens and closes its on-screen keyboard (only the fact, never the text).
- TV options also have a "Keyboard trial" section to send a text to the TV from the settings page.

Known limits: Apple does not publish this protocol, so an iOS update may break it. Apps with their own keyboard, such as YouTube and Netflix, are reported not to accept typed text; the TV's own search and browser fields do. The keyboard opens while the remote is open, not as a lock-screen notice.

Checked against an independent Apple TV client and a simulated iPhone. Not yet tried with a real iPhone or a real TV.

**بالعربية**

نسخة تجريبية تُنشر على قناة «beta» فقط. الإصدار المستقر يبقى 1.3.2.

الكتابة على تلفزيون Samsung من ريموت الآيفون الأصلي.

- **خيار جديد لكل تلفزيون: «ريموت الآيفون مع الكيبورد (تجريبي)».** يظهر التلفزيون في ريموت مركز التحكم كأنه Apple TV، باسمه متبوعًا بعلامة «+». يُقترن مرة واحدة برمز من أربع خانات يظهر في خيارات التلفزيون. بعدها تصل الأزرار والسحب والصوت والتشغيل إلى التلفزيون، وحين يفتح التلفزيون خانة كتابة يفتح كيبورد الآيفون وما تكتبه يظهر على التلفزيون.
- بطاقة التلفزيون في Apple Home واقترانها وموافقة التلفزيون تبقى كما هي. الخيار يضيف اسمًا ثانيًا في قائمة الريموت.
- يعمل داخل هذه الإضافة نفسها دون تثبيت شيء آخر، ويبقى داخل شبكة المنزل.
- كل ما يحفظه ملف واحد في مجلد الإضافة (`apple-remote.json`). إطفاء الخيار يحذفه، والرجوع إلى 1.3.2 لا يترك شيئًا في النظام.
- السجل يذكر متى يفتح التلفزيون كيبورد الشاشة ومتى يغلقه (الحدث فقط، ولا يُكتب النص).
- في خيارات التلفزيون أيضًا قسم «تجربة الكيبورد» لإرسال نص إلى التلفزيون من صفحة الإعدادات.

حدود معروفة: Apple لا تنشر هذا البروتوكول، فقد يتعطل مع تحديث iOS. التطبيقات التي لها كيبورد خاص مثل YouTube و Netflix يُذكر أنها لا تقبل النص المكتوب؛ أما بحث التلفزيون نفسه والمتصفح فيقبلانه. يفتح الكيبورد والريموت مفتوح، وليس كتنبيه على شاشة القفل.

جرى الفحص مع عميل Apple TV مستقل ومع آيفون محاكى. لم تُجرَّب بعد مع آيفون حقيقي ولا تلفزيون حقيقي.
## 1.3.4

The one-second gap of 1.3.3 did not stop first attempts from failing after a restart (seen on real appliances). This version measures instead of guessing.

- **The log says where a failed connection stopped:** opening the secure session, asking the appliance who it is, the first reading, or normal use, and after how long. Both engines.
- **A five-second wait after start** before the first appliance is asked, in case an appliance is still letting go of the session that was closed a moment earlier. The one-second gap between appliances stays.

Whether the wait helps is not known yet; a few restarts on real appliances will show.

**بالعربية**

فاصل الثانية في 1.3.3 لم يمنع فشل المحاولة الأولى بعد إعادة التشغيل (ظهر ذلك على أجهزة حقيقية). هذا الإصدار يقيس بدل أن يخمّن.

- **السجل يذكر أين توقف الاتصال الفاشل:** عند فتح الجلسة الآمنة، أو سؤال الجهاز عن هويته، أو القراءة الأولى، أو أثناء العمل، وبعد كم ثانية. في المحركين.
- **انتظار خمس ثوانٍ بعد بدء التشغيل** قبل طلب أول جهاز، لاحتمال أن الجهاز ما زال يُنهي الجلسة التي أُغلقت قبل لحظة. وفاصل الثانية بين الأجهزة باقٍ.

هل يفيد الانتظار؟ لم يُعرف بعد؛ بضع إعادات تشغيل على أجهزة حقيقية تبيّن ذلك.

## 1.3.3

Two fixes from a day of logs on real appliances.

- **Start-up:** appliances are now connected one after another, a second apart. Asked all in the same instant, one or two often refused the first attempt and came back ten seconds later.
- **TVs that do not name their power state:** such a TV keeps answering on the network after its screen goes dark, and wakes by itself at night, so its tile showed "on" for hours. The plugin now also looks at the TV's media service, which these sets run only while the screen is on. Once that service has been seen on a TV, its absence means off. A TV that never shows it is judged as before, so nothing changes for the worse.

The second fix is not yet confirmed on a real TV: the log line "its screen service will tell on from off" shows whether a TV has that service.

**بالعربية**

إصلاحان من سجل يوم كامل على أجهزة حقيقية.

- **بدء التشغيل:** صار الاتصال بالأجهزة واحدًا بعد الآخر بفاصل ثانية. حين كانت تُطلب كلها في اللحظة نفسها، كان جهاز أو اثنان يرفضان المحاولة الأولى ويعودان بعد عشر ثوانٍ.
- **التلفزيونات التي لا تذكر حالة تشغيلها:** هذا النوع يبقى يجيب على الشبكة بعد انطفاء شاشته، ويستيقظ وحده ليلًا، فكانت بطاقته تظهر «يعمل» لساعات. صارت الإضافة تنظر أيضًا إلى خدمة الوسائط في التلفزيون، وهي تعمل في هذه الأجهزة والشاشة مضاءة فقط. بعد أن تُرى هذه الخدمة مرة على تلفزيون، يعني غيابها أنه مطفأ. والتلفزيون الذي لم تظهر عليه أبدًا يُحكم عليه كما كان، فلا يسوء شيء.

الإصلاح الثاني لم يتأكد بعد على تلفزيون حقيقي: سطر السجل «its screen service will tell on from off» يبيّن هل في التلفزيون هذه الخدمة.

## 1.3.2

No change in behaviour. The plugin description now mentions the automatic scan, and the README explains it with three pictures.

**بالعربية**

لم يتغيّر السلوك. وصف الإضافة صار يذكر المسح التلقائي، وصفحة الشرح تعرضه بثلاث صور.

## 1.3.1

Automatic scan, after the first try on real appliances found nothing:

- The question is now asked in the same form both engines already use with these appliances (reply format stated), besides the bare form, and up to three times, since a Wi-Fi appliance often misses the first one. It is also sent once to the OCF group address of the network.
- Networks made by container software on the same machine (Docker and the like) are no longer scanned.
- Under the result, one line says how many addresses are alive on the network, how many answered as appliances and how many are TVs, so an empty result can be judged.

Confirmed on a real network: five air conditioners, a washer and a TV answered in one scan. Adding a new appliance from the list is not yet tried on real hardware.

**بالعربية**

المسح التلقائي، بعد أن عادت أول تجربة على أجهزة حقيقية بلا نتائج:

- صار السؤال يُرسل بالصيغة نفسها التي يستخدمها المحركان مع هذه الأجهزة (مع تحديد صيغة الرد)، إضافة إلى الصيغة المختصرة، وحتى ثلاث مرات، لأن جهاز Wi-Fi كثيرًا ما يفوّت السؤال الأول. ويُرسل كذلك مرة إلى عنوان مجموعة OCF في الشبكة.
- الشبكات التي تنشئها برامج الحاويات على الجهاز نفسه (مثل Docker) خرجت من المسح.
- تحت النتيجة سطر يبيّن عدد العناوين العاملة على الشبكة، وكم منها أجاب كجهاز، وعدد التلفزيونات، ليسهل الحكم على نتيجة فارغة.

تأكدت على شبكة حقيقية: أجابت خمسة مكيفات وغسالة وتلفزيون في مسح واحد. إضافة جهاز جديد من القائمة لم تُجرَّب بعد على أجهزة حقيقية.

## 1.3.0

New: automatic scan, in the settings page, for both engines.

- **Scan the network** looks once across your home network for Samsung appliances and TVs, reads what each new one is, and lists them. Tick the ones you want and press **Add selected**; name and options are then changed under each row, as before.
- It runs only when the button is pressed, never in the background. Nothing is added or stored before you confirm.
- Appliances already in your list are shown as added and are not read again. One that answers from a new address has its address updated instead of being added twice.
- A TV asks for one approval on its screen before it can be ticked. An appliance that could not be read gets a **Read** button to try again.
- Adding by hand with an IP or MAC address stays as it was, now as the second way under the same card. IP and MAC address are kept for every appliance either way, so a changed address is followed as before.
- A TV found by either way gets a default name Apple Home accepts.

Not yet tried on real appliances.

**بالعربية**

جديد: مسح تلقائي في صفحة الإعدادات، للمحركين معًا.

- زر **مسح الشبكة** يبحث مرة واحدة في شبكة المنزل عن أجهزة وتلفزيونات Samsung، ويتعرّف على كل جهاز جديد، ثم يعرضها في قائمة. حدّد ما تريد واضغط **إضافة المحدد**؛ ثم يُعدَّل الاسم والخيارات تحت كل صف كما هو معمول.
- يعمل عند ضغط الزر فقط، ولا يعمل في الخلفية. لا يُضاف ولا يُحفظ شيء قبل تأكيدك.
- الأجهزة المضافة مسبقًا تظهر بوصفها مضافة ولا تُقرأ من جديد. والجهاز الذي يجيب من عنوان جديد يُحدَّث عنوانه ولا يُضاف مرتين.
- التلفزيون يطلب موافقة واحدة على شاشته قبل تحديده. والجهاز الذي تعذّرت قراءته يظهر بجانبه زر **قراءة** للمحاولة من جديد.
- الإضافة اليدوية بعنوان IP أو MAC باقية كما هي، وصارت الطريقة الثانية في البطاقة نفسها. يُحفظ عنوان IP وعنوان MAC لكل جهاز في الطريقتين، فيُتتبَّع العنوان إذا تغيّر كما هو معمول.
- التلفزيون المكتشف بأي من الطريقتين يأخذ اسمًا افتراضيًا يقبله Apple Home.

لم تُجرَّب بعد على أجهزة حقيقية.

## 1.2.2

Air conditioner, both engines:

- One command, one beep. Switching on from Apple Home used to send two or three commands in a row (power, then the mode again, sometimes power a second time through the fan tile), and the unit beeped for each one. Now only a real change is sent: switching on in the mode the unit was left in sends the power command alone; the same request arriving through several tiles is sent once; a value the appliance already has is not sent again.
- Switching off no longer sends a command for the display light as well. Its setting is left alone, so the display lights again with the next switch-on.
- With fewer commands, switching on and off is also quicker.

Settings page: the engine choice and the washer's cycle tile choice are no longer cut off.

**بالعربية**

المكيف، مع المحركين:

- أمر واحد وصوت واحد. كان التشغيل من Apple Home يرسل أمرين أو ثلاثة متتالية (التشغيل، ثم الوضع من جديد، وأحيانًا التشغيل مرة ثانية عبر بطاقة المروحة)، فيصدر المكيف صوتًا لكل أمر. الآن يُرسل التغيير الفعلي فقط: التشغيل على الوضع الذي تُرك عليه المكيف يرسل أمر التشغيل وحده، والطلب الواحد الذي يصل من عدة بطاقات يُرسل مرة واحدة، والقيمة الموجودة أصلًا في الجهاز لا تُرسل من جديد.
- الإطفاء لم يعد يرسل معه أمرًا لإضاءة الشاشة. يبقى إعدادها كما هو، فتضيء الشاشة مع التشغيل التالي.
- مع أوامر أقل صار التشغيل والإطفاء أسرع.

صفحة الإعدادات: خانة اختيار المحرك وخانة بطاقة دورة الغسالة لم تعودا تقطعان النص.

## 1.2.1

Settings page:

- Options open under the appliance for every kind: air conditioner, washer and TV. In 1.2.0 a TV still opened at the top of the page.
- An appliance that has not been read yet is asked on the spot, and its options show under it as well.
- Once a TV has been added to Apple Home, its code folds away behind "Show the code" so the list stays short.
- Saving the options of an appliance that is switched off in the list no longer switches it back on.

**بالعربية**

صفحة الإعدادات:

- الخيارات تُفتح تحت الجهاز أيًّا كان نوعه: مكيف أو غسالة أو تلفزيون. في 1.2.0 كان التلفزيون ما زال يُفتح أعلى الصفحة.
- الجهاز الذي لم يُقرأ بعد يُسأل في الحال، وتظهر خياراته تحته أيضًا.
- بعد إضافة التلفزيون إلى Apple Home يُطوى رمزه خلف «عرض الرمز» حتى تبقى القائمة قصيرة.
- حفظ خيارات جهاز موقوف في القائمة لم يعد يعيد تفعيله.

## 1.2.0

The number moves to 1.2 because the plugin now does more than it did at 1.1. Nothing changes in the saved settings; the code is the same as 1.1.11.

- **Samsung TVs** are tried on four real TVs, newer and older: pairing on the TV screen, a TV tile with the Control Centre remote, the Home app code shown on the settings page, and a tile that follows the TV's real power state.
- **Settings page** reworked: options open under each appliance, a discovery result sits right under the address field, names are changed in place, and removing asks first.
- **Washer** "Finished" notice follows the appliance's own announcement.
- **Stability**: one line a day per appliance with the number of connection losses and the longest gap; a command answered 4.00 is asked once more.
- **Both engines** (Python and JavaScript) run all of the above.

**بالعربية**

ينتقل الرقم إلى 1.2 لأن الإضافة صارت تفعل أكثر مما كانت عليه في 1.1. لا يتغير شيء في الإعدادات المحفوظة، والكود هو نفسه كود 1.1.11.

- **تلفزيونات Samsung** جُرّبت على أربعة تلفزيونات حقيقية، حديثة وقديمة: الاقتران من شاشة التلفزيون، بطاقة تلفزيون مع ريموت مركز التحكم، رمز تطبيق Home داخل صفحة الإعدادات، وبطاقة تتبع حالة التلفزيون الفعلية.
- **صفحة الإعدادات** أُعيد ترتيبها: الخيارات تُفتح تحت كل جهاز، نتيجة البحث تحت حقل العنوان مباشرة، الاسم يُغيَّر في مكانه، والحذف يطلب تأكيدًا.
- **الغسالة**: إشعار «انتهى» يتبع إعلان الجهاز نفسه.
- **الاستقرار**: سطر يومي لكل جهاز بعدد مرات فقد الاتصال وأطول انقطاع، والأمر الذي يُجاب بالرمز 4.00 يُعاد مرة واحدة.
- **المحركان** (Python و JavaScript) يشغّلان كل ما سبق.

## 1.1.11

- TV remote: the channel to the TV stays open for five minutes after the last press instead of twenty seconds, so presses no longer wait for a new secure connection each time. It is closed as soon as the TV goes off.

**بالعربية**

- ريموت التلفزيون: تبقى قناة الاتصال بالتلفزيون مفتوحة خمس دقائق بعد آخر ضغطة بدل عشرين ثانية، فلا تنتظر الضغطات اتصالًا آمنًا جديدًا في كل مرة. وتُغلق حالما يُطفأ التلفزيون.

## 1.1.10

Settings page, easier to use. Nothing changes in the saved settings or in Apple Home.

- The options of a configured appliance open under the appliance itself, and close with the same button. Before, they opened at the top of the page.
- After Test & discover, the name, the options and the Add button come right under the address field. What the appliance reports is under them.
- A name can be changed in place: press the pencil beside it.
- Each appliance has one Options button and three small labelled buttons: Change IP, Diagnostics, Remove.
- Test & discover with a MAC address: when the appliance no longer answers at the address remembered for it, it is looked up again by its MAC address.
- A TV added by its MAC address is woken through that address (the interface it is really connected with).

**بالعربية**

صفحة الإعدادات أسهل استخدامًا، دون أي تغيير في الإعدادات المحفوظة أو في Apple Home.

- خيارات الجهاز المضاف تُفتح تحت الجهاز نفسه وتُغلق بالزر نفسه. كانت تُفتح أعلى الصفحة.
- بعد «اختبار واكتشاف» يأتي الاسم والخيارات وزر الإضافة تحت حقل العنوان مباشرة، وتحتها ما يعلنه الجهاز.
- يمكن تغيير الاسم في مكانه: اضغط القلم بجانبه.
- لكل جهاز زر «الخيارات» وثلاثة أزرار صغيرة مكتوب تحتها: تغيير العنوان، التشخيص، حذف.
- «اختبار واكتشاف» بعنوان MAC: إذا لم يجب الجهاز على العنوان المحفوظ له، يُبحث عنه من جديد بعنوان MAC.
- التلفزيون المضاف بعنوان MAC يُوقَظ عبر هذا العنوان (الواجهة المتصل بها فعلًا).

## 1.1.9

- TV shown as on while it was off: some TVs name their power state while on and in standby, then go into a deeper sleep in which they still answer but no longer name it. That is now taken as off. What is learned about a TV is kept across restarts. A model that never names its power state is still taken as on while it answers.

**بالعربية**

- التلفزيون يظهر «يعمل» وهو مطفأ: بعض التلفزيونات تذكر حالتها وهي تعمل وفي الاستعداد، ثم تدخل سباتًا أعمق تبقى تجيب فيه دون ذكر الحالة. صار ذلك يُعدّ إطفاءً. وما يُعرف عن التلفزيون يُحفظ بعد إعادة التشغيل. الموديل الذي لا يذكر حالته أبدًا يبقى «يعمل» ما دام يجيب.

## 1.1.8

- Settings page: removing an appliance asks first. The Remove button has to be pressed twice within a few seconds.

**بالعربية**

- صفحة الإعدادات: حذف جهاز يطلب تأكيدًا أولًا. يلزم الضغط على زر الحذف مرتين خلال ثوانٍ.

## 1.1.7

TV tile and TV switches:

- The tile follows the TV more closely: the TV is asked every 4 seconds instead of 10, and after a switch from Apple Home the wait ends as soon as the TV agrees.
- The power key is a toggle. The TV is now asked for its real state just before the key is sent, so a tile that was out of date can no longer switch the TV the wrong way.
- Remote keys are sent whenever the TV answers, also while the tile still shows it as off.
- The log states what the TV itself reports about its power whenever that changes.

**بالعربية**

بطاقة التلفزيون ومفاتيحه:

- البطاقة تتابع التلفزيون عن قرب: يُسأل التلفزيون كل 4 ثوانٍ بدل 10، وبعد التبديل من Apple Home ينتهي الانتظار حالما يوافق التلفزيون.
- زر التشغيل زر تبديل. يُسأل التلفزيون الآن عن حالته الفعلية قبل إرسال الزر مباشرة، فلا تبدّله بطاقة قديمة الحالة في الاتجاه الخطأ.
- أزرار الريموت تُرسل ما دام التلفزيون يجيب، حتى والبطاقة ما زالت تعرضه مطفأً.
- السجل يكتب ما يقوله التلفزيون نفسه عن حالته كلما تغيّرت.

## 1.1.6

- TV tile: the code for the Home app is shown on the plugin settings page, beside the TV, as a picture to scan with the digits under it. No more searching the log. It also says whether the TV has been added to Apple Home.
- Guide: how to add a TV tile and find its remote, with a picture of the tile.

**بالعربية**

- بطاقة التلفزيون: رمز تطبيق Home يظهر في صفحة إعدادات الإضافة بجانب التلفزيون، صورةً للمسح والأرقام تحتها، دون بحث في السجل. ويبيّن هل أُضيف التلفزيون إلى Apple Home.
- الدليل: طريقة إضافة بطاقة التلفزيون والوصول إلى الريموت، مع صورة للبطاقة.

## 1.1.5

- Washer "Finished" sensor: on a model that announces the end of a cycle itself ("Finish"), only that announcement triggers the sensor. A cycle that is cancelled or switched off gives no notice and is noted in the log instead. Models that never announce it keep the earlier behaviour.
- A washer left showing "Finish" no longer triggers the sensor again every time the bridge restarts; a cycle that ended while the bridge was down is still noticed.
- Daily stability line: the figures are kept on disk, so an update or restart no longer discards the day measured so far. A loss running across two periods is counted once. An appliance that never connected is listed as "did not connect during the period".

**بالعربية**

- حساس «انتهى» في الغسالة: في الموديل الذي يعلن نهاية الدورة بنفسه («Finish») يُفعَّل الحساس بهذا الإعلان فقط. الدورة الملغاة أو المطفأة لا تعطي إشعارًا، ويُكتب ذلك في السجل. الموديلات التي لا تعلن النهاية تبقى على السلوك السابق.
- الغسالة المتروكة على «Finish» لم تعد تفعّل الحساس من جديد مع كل إعادة تشغيل للجسر، والدورة التي انتهت والجسر متوقف ما زالت تُلتقط.
- سطر الاستقرار اليومي: تُحفظ الأرقام على القرص، فلا يضيع قياس اليوم عند التحديث أو إعادة التشغيل. الانقطاع الممتد على فترتين يُحسب مرة واحدة. والجهاز الذي لم يتصل أبدًا يظهر بعبارة «did not connect during the period».

## 1.1.4

- Once every 24 hours the log states, for each appliance, how many times the connection was lost and the longest gap. Restarts of the bridge are not counted.
- Guide: the requirements start from the choice of engine. JavaScript works as installed; Python 3.11 or newer is needed only for the Python engine.
- Package description now covers air conditioners, the washer and TVs.

**بالعربية**

- يكتب السجل كل 24 ساعة، لكل جهاز، عدد مرات فقد الاتصال وأطول انقطاع. إعادة تشغيل الجسر لا تُحتسب.
- الدليل: تبدأ المتطلبات من اختيار المحرك. يعمل JavaScript مباشرة بعد التثبيت، و Python 3.11 أو أحدث مطلوب لمحرك Python فقط.
- وصف الحزمة صار يشمل المكيفات والغسالة والتلفزيونات.

## 1.1.3

- A command answered 4.00 is asked once more after a short pause. On a real air conditioner a correct power command was now and then refused with 4.00, with the Python engine as well as the JavaScript one, so the cause is the appliance and not the engine. The log says when this happens and how the second ask ended.

**بالعربية**

- الأمر الذي يُجاب بالرمز 4.00 يُعاد مرة واحدة بعد مهلة قصيرة. على مكيف حقيقي رُفض أمر تشغيل صحيح بالرمز 4.00 أحيانًا، مع محرك Python كما مع JavaScript، فالسبب من الجهاز وليس من المحرك. يذكر السجل متى حدث ذلك وكيف انتهت المحاولة الثانية.

## 1.1.2

- Air conditioner: switching off from the Home app now shows off on every tile of the accessory at once. Before, the fan and switches stayed on until the appliance reported, so the tile read "Powered On" for a few seconds and then went to Off. Both engines.

**بالعربية**

- المكيف: الإطفاء من تطبيق Home يظهر الآن على كل بطاقات الجهاز فورًا. كانت المروحة والمفاتيح تبقى «تعمل» حتى يبلّغ الجهاز، فتظهر البطاقة «Powered On» ثوانيَ ثم تعود إلى Off. يشمل المحركين.

## 1.1.1

JavaScript engine only; the Python engine is unchanged.

- Port search rewritten to ask the way the Python engine does: the small directory first and then the full one, asking again while the appliance is silent, following answers that arrive in several parts, and reading both ways a port can be written. In 1.1.0 the search found nothing on real appliances and every connection fell back to trying ports one by one (16 to 21 seconds).
- A command now states the reply format it accepts, exactly as the Python engine sends it. One "power on" was refused with 4.00 under 1.1.0; this was the one difference found between the two engines' commands.
- The message "did not answer on its usual port" no longer ends with empty brackets.

**بالعربية**

يخص محرك JavaScript فقط، ومحرك Python كما هو.

- أُعيدت كتابة البحث عن المنفذ ليسأل كما يسأل محرك Python: الدليل الصغير أولًا ثم الكامل، مع تكرار السؤال ما دام الجهاز صامتًا، ومتابعة الجواب إذا وصل على أجزاء، وقراءة الصيغتين اللتين يُكتب بهما المنفذ. في 1.1.0 لم يجد البحث شيئًا على الأجهزة الحقيقية، فكان كل اتصال يجرّب المنافذ واحدًا واحدًا (من 16 إلى 21 ثانية).
- صار الأمر يذكر صيغة الرد التي يقبلها، تمامًا كما يرسله محرك Python. رُفض أمر تشغيل واحد بالرمز 4.00 في 1.1.0، وهذا هو الفرق الوحيد الذي وُجد بين أوامر المحركين.
- رسالة «did not answer on its usual port» لم تعد تنتهي بقوسين فارغين.

## 1.1.0

The JavaScript connection engine, introduced in 1.0.14 and tried in the 1.1.0 betas, is now a regular choice next to Python: it ran five air conditioners and a washer on real hardware. You pick the engine at the top of the settings page and can switch at any time. There are no more beta releases; this version replaces them.

- Faster start: the port each appliance uses is remembered with its address, so the next start connects straight to it instead of searching first. If the appliance changed its port (after a power cut, for example) the search runs as before.
- The log now says how long each connection took, and with the JavaScript engine where the time went (secure session, identity, first reading).
- Confirmed on a real washer: tapping the cycle tile flips it and it returns at once, with no error.

**بالعربية**

محرك الاتصال بلغة JavaScript، الذي دخل في 1.0.14 وجُرّب في نسخ 1.1.0 التجريبية، صار خيارًا عاديًا بجانب Python بعد أن شغّل خمسة مكيفات وغسالة على أجهزة حقيقية. تختار المحرك من أعلى صفحة الإعدادات وتبدّل متى شئت. انتهت النسخ التجريبية، وهذا الإصدار يحل محلها.

- تشغيل أسرع: يُحفظ منفذ كل جهاز مع عنوانه، فيتصل التشغيل التالي به مباشرة دون بحث. وإذا غيّر الجهاز منفذه (بعد انقطاع الكهرباء مثلًا) يجري البحث كما كان.
- صار السجل يذكر مدة كل اتصال، ومع محرك JavaScript أين ذهب الوقت (الجلسة المشفرة، الهوية، القراءة الأولى).
- تأكد على غسالة حقيقية: الضغط على بطاقة الدورة يقلبها وتعود فورًا دون خطأ.

## 1.0.19

- Laundry: the read-only cycle tile from 1.0.18 is withdrawn. On a real washer the Home app still sent the tap, got a refusal and showed "No Response" for some seconds. The tile accepts the tap again and undoes it at once, with no error. To have nothing happen at all on a tap, choose "Running sensor" under Configuration → "How the cycle tile behaves" (it has no countdown).

**بالعربية**

- أجهزة الغسيل: سُحبت بطاقة الدورة «للقراءة فقط» التي جاءت في 1.0.18. على غسالة حقيقية بقي تطبيق Home يرسل الضغطة، فيُرفض الأمر وتظهر «No Response» ثوانيَ. عادت البطاقة تقبل الضغطة وتلغيها فورًا دون خطأ. وإذا أردت ألا يحدث شيء إطلاقًا عند الضغط فاختر «حساس تشغيل» من «Configuration ← سلوك بطاقة الدورة» (وهو دون عدّاد).

## 1.0.18

- Laundry: the cycle tile no longer reacts to a tap. The Home app sends an on/off command when a valve tile's icon is tapped; the tile is now read-only, so there is nothing to send, and the countdown inside stays. Under Configuration, "How the cycle tile behaves" also offers a plain tile or a running sensor.

- Settings page header: a green verified mark on the icon and a row of badges (Homebridge Verified, installed version, engine in use, how many appliances are connected).
- Settings page: after a command, each appliance shows its measured command response time and the engine in use, measured the same way for both engines, so the two can be compared on your own appliances.

JavaScript engine, after its first run on real appliances (five air conditioners and a washer connected and answered commands):

- Push updates: each registration is now confirmed by the appliance before the next one is sent, and sent once more when no answer comes. Before, some appliances silently dropped registrations that arrived in a burst and then reported changes only at the polling interval.
- Reconnecting: a known appliance is asked again on its own port instead of walking every usual port, so a short silence no longer shows as "not reachable" for a minute.
- Speed: the engine sent at most five datagrams a second, so one full reading took about two seconds and a command could wait behind it. It now sends up to twenty-five.
- First contact: the appliance is asked for its port twice, with a longer wait the second time, for appliances that answer late (seen on a washer).

**بالعربية**

- أجهزة الغسيل: بطاقة الدورة لم تعد تتأثر بالضغط. تطبيق Home يرسل أمر تشغيل أو إيقاف عند الضغط على أيقونة الصمام، وصارت البطاقة للقراءة فقط، فلا يُرسل شيء، ويبقى العدّاد في داخلها. من «Configuration» يوجد خيار «سلوك بطاقة الدورة» وفيه أيضًا بطاقة عادية أو حساس تشغيل.

- رأس صفحة الإعدادات: علامة توثيق خضراء على الأيقونة وصف من الشارات (موثقة من Homebridge، الإصدار المثبّت، المحرك المستخدم، عدد الأجهزة المتصلة).
- صفحة الإعدادات: بعد أي أمر يظهر تحت كل جهاز زمن استجابة الأمر المقاس والمحرك المستخدم، بطريقة قياس واحدة للمحركين، لتقارن بينهما على أجهزتك.

محرك JavaScript بعد أول تشغيل له على أجهزة حقيقية (اتصلت خمسة مكيفات وغسالة واستجابت للأوامر):

- التحديثات الفورية: صار كل تسجيل يُؤكَّد من الجهاز قبل إرسال التالي، ويُعاد مرة إذا لم يصل الرد. كانت بعض الأجهزة تتجاهل التسجيلات المرسلة دفعة واحدة، فتظهر التغييرات عند فاصل القراءة فقط.
- إعادة الاتصال: الجهاز المعروف يُسأل مجددًا على منفذه نفسه دون المرور على كل المنافذ المعتادة، فلا يظهر صمت قصير على أنه «not reachable» لمدة دقيقة.
- السرعة: كان المحرك يرسل خمس رسائل في الثانية على الأكثر، فتأخذ القراءة الكاملة نحو ثانيتين وقد ينتظر الأمر خلفها. صار يرسل حتى خمس وعشرين.
- الاتصال الأول: يُسأل الجهاز عن منفذه مرتين، بانتظار أطول في الثانية، للأجهزة التي تتأخر في الرد (ظهر ذلك مع الغسالة).

## 1.0.17

- Laundry appliances: three more options, off until you tick them. A progress tile that shows the cycle's percentage on the tile itself (the Home app prints a number only for a few tile types, so it carries a humidity icon). Child lock status. An alert sensor that turns on when the appliance reports a fault.
- The settings page also shows how many washes the appliance has done.
- "Reported but not used yet" now lists only what the plugin really does not read.
- README: screenshots of the per-appliance options.

**بالعربية**

- أجهزة الغسيل: ثلاثة خيارات إضافية، مطفأة حتى تحددها. بطاقة نسبة التقدم التي تعرض نسبة الدورة على وجه البطاقة (تطبيق Home يطبع الرقم لأنواع قليلة من البطاقات، فتظهر بأيقونة الرطوبة). حالة قفل الأطفال. حساس تنبيه يتفعّل عند إعلان الجهاز عن عطل.
- تعرض صفحة الإعدادات أيضًا عدد الغسلات التي أنجزها الجهاز.
- قائمة «Reported but not used yet» صارت تعرض ما لا تقرؤه الإضافة فعلًا فقط.
- الصفحة الرئيسية: صور لخيارات كل جهاز.

## 1.0.16

- Settings page: the connection engine is now the first step, at the top. A new installation chooses it knowingly before anything else; an installation that already has appliances keeps the engine it runs on.
- With the JavaScript engine chosen, the page shows how much space the unused Python runtime still takes and offers one button to remove it. Only the runtime this plugin downloaded is removed; Python itself, the certificate and the settings stay. This also makes Homebridge backups smaller.

**بالعربية**

- صفحة الإعدادات: صار محرك الاتصال الخطوة الأولى في أعلى الصفحة. التثبيت الجديد يختاره عن علم قبل أي شيء آخر، والتثبيت الذي فيه أجهزة يبقى على محركه الحالي.
- عند اختيار محرك JavaScript تعرض الصفحة المساحة التي ما زالت تشغلها بيئة Python غير المستخدمة، مع زر واحد لحذفها. يُحذف ما نزّلته الإضافة فقط، ويبقى Python نفسه والشهادة والإعدادات. بذلك تصغر نسخ Homebridge الاحتياطية أيضًا.

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
