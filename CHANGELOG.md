# Changelog

Versions follow [Semantic Versioning](https://semver.org/). Releases are published under the npm tag `latest`; pre-releases under `beta`.

## 1.9.4-beta.2

The "send together" trial, second try: power first. Your settings, pairings and accessories are kept as they are.

- **Trial "send together": power now comes first in the message.** Seen on a real unit with beta.1 (power last): one beep, its display showed the new temperature, and then it went back to its earlier temperature and display as it switched on, as if switching on restores what the unit had before. With power first, the unit is on when the other settings reach it.
- The log no longer repeats each command of a message that went together; the one `sent together` line lists them.
- When a unit accepts a command but does not apply it, the log now says what it reports instead.
- In Auto mode, an option the unit refuses (seen with WindFree) is not sent a second time, and the log says to choose Cool or another mode first.
- If the trial is dropped later, the next version removes the tick and what it stored, leaving nothing behind.

**بالعربية**

تجربة «الإرسال معًا»، المحاولة الثانية: التشغيل أولًا. إعداداتك واقتراناتك وأجهزتك في Apple Home تبقى كما هي.

- **تجربة «الإرسال معًا»: التشغيل الآن أول الرسالة.** شوهد على مكيف حقيقي مع beta.1 (التشغيل آخرها): نغمة واحدة، وعرضت شاشته الحرارة الجديدة، ثم رجع إلى حرارته وشاشته السابقتين عند التشغيل، كأن التشغيل يعيد ما كان عليه المكيف. مع التشغيل أولًا يكون المكيف يعمل حين تصله بقية الإعدادات.
- السجل لم يعد يكرر كل أمر من رسالة أُرسلت معًا، فسطر `sent together` يذكرها كلها.
- إذا قبل المكيف أمرًا ولم يطبقه، يكتب السجل الآن ما يبلّغ عنه المكيف بدلًا منه.
- في وضع Auto، الخيار الذي يرفضه المكيف (شوهد مع WindFree) لا يُرسل مرة ثانية، ويكتب السجل أن تختار Cool أو وضعًا آخر أولًا.
- إذا أُلغيت التجربة لاحقًا، يزيل الإصدار التالي العلامة وما خزّنته، فلا يبقى منها شيء.

## 1.9.4-beta.1

A trial for air conditioners: switch-on with mode and temperature in one message, so the unit beeps once, as with its own remote. Off unless you tick it. Your settings, pairings and accessories are kept as they are.

- **Trial: "Switch-on with mode and temperature in one message".** A new tick in each air conditioner's options, off by default. Apple Home sends switch-on, mode and temperature as separate requests, and each message the unit receives makes it beep. With the tick, while the unit is off, these requests are gathered for 0.4 s and sent as one batch update, power last. While the unit is on, nothing changes: commands go at once, as before.
- Each command is still checked against the unit's own report afterwards.
- A unit that refuses the batch update gets the commands one by one, as before; the log says so once, and the unit is not asked again until the tick is cleared.
- The log says `sent together, in one message: …` when it worked.
- Both engines, Python and JavaScript.
- If the trial is dropped later, the next version removes the tick and what it stored (the tick in the settings, and the note that a unit refused it), leaving nothing behind.

**بالعربية**

تجربة للمكيفات: التشغيل مع الوضع والحرارة في رسالة واحدة، فيصدر المكيف نغمة واحدة كما مع ريموته. لا تعمل إلا إذا وضعت علامتها. إعداداتك واقتراناتك وأجهزتك في Apple Home تبقى كما هي.

- **تجربة: «التشغيل مع الوضع والحرارة في رسالة واحدة».** علامة جديدة في خيارات كل مكيف، غير مفعّلة افتراضيًا. Apple Home يرسل التشغيل والوضع والحرارة طلبات منفصلة، وكل رسالة تصل المكيف تصدر نغمة. مع العلامة، والمكيف مطفأ، تُجمع هذه الطلبات 0.4 ثانية وتُرسل في رسالة مجمّعة واحدة، والتشغيل آخرها. والمكيف يعمل لا يتغير شيء: الأوامر تخرج فورًا كما كانت.
- كل أمر ما زال يُطابَق بعدها على تقرير المكيف نفسه.
- المكيف الذي يرفض الرسالة المجمّعة تصله الأوامر واحدًا واحدًا كما كانت، ويكتب السجل ذلك مرة واحدة، ولا يُسأل مرة أخرى حتى تُزال العلامة.
- السجل يكتب `sent together, in one message: …` عند النجاح.
- على المحرّكين: Python وJavaScript.
- إذا أُلغيت التجربة لاحقًا، يزيل الإصدار التالي العلامة وما خزّنته (العلامة في الإعدادات، وملاحظة أن المكيف رفضها)، فلا يبقى منها شيء.

## 1.9.3

The log names each command sent to an air conditioner. Your settings, pairings and accessories are kept as they are.

- **New in the log: one short line per air conditioner command**, for example `sent: power on.`, `sent: mode cool.`, `sent: target 22°C.` Each command that reaches an air conditioner makes it beep, so when one switch-on is heard as several beeps, the log now shows which commands they were. Nothing else changes: the same commands are sent as before.

**بالعربية**

السجل يسمّي كل أمر يُرسل إلى المكيف. إعداداتك واقتراناتك وأجهزتك في Apple Home تبقى كما هي.

- **جديد في السجل: سطر قصير لكل أمر يُرسل إلى المكيف**، مثل `sent: power on.` و`sent: mode cool.` و`sent: target 22°C.` كل أمر يصل المكيف يصدر نغمة، فإذا سُمع تشغيل واحد بعدة نغمات يُظهر السجل الآن أي الأوامر كانت. لم يتغير شيء آخر: الأوامر المرسلة هي نفسها.

## 1.9.2

A washer group no longer leaves its room in Apple Home. Your settings, pairings and accessories are kept as they are.

- **Fixed: a washer group that left Apple Home and came back outside its room.** Seen on a real washer with the "Options" group: for a while the washer did not list its extras, the group was removed, and when the extras were listed again it came back as a new accessory in the bridge's default room. A group now leaves only when its control is unticked. While the washer does not list a setting, its switches stay, show off, and send nothing.
- If a group of yours has already moved, put it back in its room once in Apple Home; it stays there from now on.
- The log says `not sent: the washer does not offer this right now` for a switch used during such a time.

**بالعربية**

مجموعة الغسالة لم تعد تخرج من غرفتها في Apple Home. إعداداتك واقتراناتك وأجهزتك في Apple Home تبقى كما هي.

- **إصلاح: مجموعة للغسالة خرجت من Apple Home ثم عادت خارج غرفتها.** شوهد على غسالة حقيقية مع مجموعة «Options»: لفترة لم تعلن الغسالة إضافاتها فأُزيلت المجموعة، ولما أعلنتها من جديد عادت كجهاز جديد في الغرفة الافتراضية للجسر. المجموعة الآن تخرج فقط عند إزالة علامة تحكمها. وما دامت الغسالة لا تعلن إعدادًا فمفاتيحه تبقى، وتظهر مطفأة، ولا ترسل شيئًا.
- إذا كانت مجموعة عندك قد انتقلت فأعدها إلى غرفتها مرة واحدة من Apple Home، وتبقى فيها بعد ذلك.
- السجل يكتب `not sent: the washer does not offer this right now` لمفتاح استُعمل في مثل هذا الوقت.

## 1.9.1

Washer settings follow each other faster. Your settings, pairings and accessories are kept as they are.

- **Faster: several washer settings in a row.** A setting sent in a form the washer has carried out before no longer holds the next one back until the washer's report arrives: the next command goes as soon as the washer has answered, after a short pause. In a simulation with the engines' real timing, the fourth of four settings reached the washer after about 4 s instead of about 12 s.
- Each command is still checked against the washer's own report, and the next form is tried when the report does not change. No extra reading is taken, and commands still go one at a time.
- Unchanged: the first use of each setting, and "Power", "Start Pause" and "Cancel Cycle".
- Tried in simulation only; not yet tried on a real washer.

**بالعربية**

إعدادات الغسالة تتتابع أسرع. إعداداتك واقتراناتك وأجهزتك في Apple Home تبقى كما هي.

- **أسرع: عدة إعدادات للغسالة واحدًا بعد الآخر.** الإعداد المرسل بصيغة نفّذتها الغسالة من قبل لم يعد يؤخر ما بعده حتى يصل تقرير الغسالة: الأمر التالي يخرج فور رد الغسالة، بعد فاصل قصير. في محاكاة بتوقيت المحرّكين الحقيقي وصل رابع أربعة إعدادات إلى الغسالة بعد نحو 4 ثوانٍ بدل نحو 12 ثانية.
- كل أمر ما زال يُطابق على تقرير الغسالة نفسها، وتُجرَّب الصيغة التالية إذا لم يتغير التقرير. لا تُضاف قراءات، والأوامر ما زالت تخرج واحدًا واحدًا.
- بلا تغيير: أول استخدام لكل إعداد، و«Power» و«Start Pause» و«Cancel Cycle».
- جُرِّب في المحاكاة فقط، ولم يُجرَّب بعد على غسالة حقيقية.

## 1.9.0

Washers can be controlled from Apple Home, as a trial that is off by default. Your settings, pairings and accessories are kept as they are.

- **New, trial: washer controls you tick one by one** in the washer's options. Nothing is sent to a washer unless a control is ticked and used.
- **Groups of switches for the settings with several values**: course, spin level, rinse count, water temperature, water level and wash time. Each group is an accessory of its own with one switch per value of the washer's own list ("Water Level 6", "Spin High"); the one that is on is the current value, and switching another on chooses it. "Show as Single Tile" in Apple Home keeps a group in one tile.
- **Courses carry their panel names on the WA80F16B9CYL top loader** ("Course Normal", "Course Quick Wash", ...), each checked at its panel. Other models show the course number until their names are known.
- **Switches**: "Power", "Start Pause", "Sound", and a group "Options" with "Super Speed", "Eco Bubble" and "Bubble Soak" where the washer reports them. "Cancel Cycle" is a press that ends the cycle and clears it; the child lock becomes settable.
- **Tried on one washer, that top loader.** With "Smart Control" off at its panel, everything above was set from Apple Home except starting and pausing a cycle, which the washer took only with "Smart Control" on at the panel. Other models may differ: untick a control that does nothing on yours.
- **New options, off by default**: a "Smart Control" sensor, detected while it is on at the panel, and an unload reminder every half hour while the washing stays inside.
- **The log shows each command**, what the washer answered and what it reported before and after, in lines that start with `control trial`; it also names a course or an extra chosen at the washer, and says what each cycle used: `cycle finished; it used 0.5 kWh and 107 L of water`. The water unit is inferred from one washer.
- **The "finished" notice comes at the minute the washer ends**, also on a washer that keeps reporting "Run" at the end of its cycle. The codes `ErrorCode_DC` (lid opened) and `ErrorCode_CL` (child lock on) are named in the log.
- New since 1.9.0-beta.9: the run switch is named "Start Pause" and "Stop" is named "Cancel Cycle", so the two say what differs; the settings say that starting may need Smart Control on at the panel; the Smart Control sensor.

**بالعربية**

الغسالات يمكن التحكم بها من Apple Home، كتجربة مطفأة افتراضيًا. إعداداتك واقتراناتك وأجهزتك في Apple Home تبقى كما هي.

- **جديد وتجريبي: تحكمات للغسالة تختارها واحدًا واحدًا** من خيارات الغسالة. لا يُرسل شيء إلى الغسالة إلا إذا اخترت التحكم واستعملته.
- **مجموعات مفاتيح للإعدادات ذات القيم المتعددة**: البرنامج وقوة العصر وعدد الشطف وحرارة الماء ومستوى الماء ومدة الغسل. كل مجموعة جهاز مستقل فيه مفتاح لكل قيمة من قائمة الغسالة نفسها («Water Level 6»، «Spin High»)، والمفعّل منها هو القيمة الحالية، وتشغيل غيره يختاره. خيار «Show as Single Tile» في Apple Home يجمع المجموعة في بلاطة واحدة.
- **البرامج تحمل أسماء اللوحة على الغسالة العلوية WA80F16B9CYL** («Course Normal»، «Course Quick Wash»، ...)، وكل اسم طُوبق على لوحتها. بقية الموديلات تعرض رقم البرنامج حتى تُعرف أسماؤها.
- **المفاتيح**: «Power» و«Start Pause» و«Sound»، ومجموعة «Options» فيها «Super Speed» و«Eco Bubble» و«Bubble Soak» حيث تعلنها الغسالة. «Cancel Cycle» ضغطة تنهي الدورة وتصفّرها، وقفل الأطفال يصبح قابلًا للضبط.
- **جُرِّب على غسالة واحدة، تلك العلوية.** و«Smart Control» مطفأ من لوحتها ضُبط كل ما سبق من Apple Home، ما عدا بدء الدورة وإيقافها مؤقتًا، فقبلتهما الغسالة فقط و«Smart Control» مفعّل من اللوحة. قد تختلف الموديلات الأخرى: أزل علامة التحكم الذي لا يعمل معك.
- **خيارات جديدة، مطفأة افتراضيًا**: حساس «Smart Control» يُكتشف ما دام مفعّلًا من اللوحة، وتذكير إخراج الغسيل كل نصف ساعة ما دام في الداخل.
- **السجل يعرض كل أمر**، وبماذا ردّت الغسالة، وما أعلنته قبل وبعد، في سطور تبدأ بـ `control trial`، ويسمّي البرنامج أو الإضافة التي تُختار من الغسالة، ويذكر استهلاك كل دورة: `cycle finished; it used 0.5 kWh and 107 L of water`. وحدة الماء مستنتجة من غسالة واحدة.
- **إشعار «انتهت» يصل في دقيقة انتهاء الغسالة**، حتى في غسالة تبقى تعلن «Run» عند نهاية دورتها. والرمزان `ErrorCode_DC` (فُتح الغطاء) و`ErrorCode_CL` (قفل الأطفال مفعّل) مسمَّيان في السجل.
- الجديد بعد 1.9.0-beta.9: مفتاح الدورة اسمه «Start Pause» و«Stop» اسمه «Cancel Cycle»، ليبيّن الاسمان الفرق، والإعدادات تذكر أن البدء قد يحتاج «Smart Control» من اللوحة، وحساس «Smart Control».

## 1.9.0-beta.9

Trial version on the "beta" channel. Corrections after 1.9.0-beta.8 was tried on a real washer. Your settings, pairings and accessories are kept as they are.

- **A course is set at once.** The form a real washer takes now goes first, and a choice that waited its turn uses what the one before it learnt. Until now each change began with a form the washer refuses, which cost about eight seconds every time.
- **The panel's extra buttons are a group of their own**, "... Options", apart from the washer's main tile: "Super Speed", "Eco Bubble" and "Bubble Soak". It first appears in the bridge's room.
- **"Bubble Storm" is now called "Eco Bubble"**, as on the panel: confirmed on a WA80F16B9CYL top loader, together with "Super Speed". "Bubble Soak" is accepted and reported by that washer, but has no light on its panel.
- **"Smart Control" is no longer offered.** On that washer both of its forms were answered "accepted" and changed nothing: remote control is set at the panel. Its switch leaves on update.
- **A switch stays where it was put a little longer** when the washer's report is late, as the groups already did. Seen on that washer: "Eco Bubble" showed in its report 15 seconds after the command.
- **Fixed: the warning about the name "Rinse + Spin" stayed** after 1.9.0-beta.8 where its tile had been renamed. The plain name is now always corrected.

**بالعربية**

إصدار تجريبي على قناة «beta». تصحيحات بعد تجربة 1.9.0-beta.8 على غسالة حقيقية. إعداداتك واقتراناتك وأجهزتك في Apple Home تبقى كما هي.

- **البرنامج يُضبط فورًا.** الصيغة التي تقبلها الغسالة الحقيقية تُرسل أولًا، والاختيار الذي انتظر دوره يستعمل ما تعلّمه الذي قبله. كان كل تغيير يبدأ بصيغة ترفضها الغسالة، فيضيع نحو ثماني ثوانٍ في كل مرة.
- **أزرار اللوحة الإضافية مجموعة مستقلة**، «... Options»، بعيدًا عن بلاطة الغسالة الرئيسية: «Super Speed» و«Eco Bubble» و«Bubble Soak». تظهر أولًا في غرفة الجسر.
- **«Bubble Storm» صار اسمه «Eco Bubble»** كما في اللوحة: تأكد على الغسالة WA80F16B9CYL، ومعه «Super Speed». و«Bubble Soak» تقبله تلك الغسالة وتعلنه، لكن ليست له إشارة في لوحتها.
- **«Smart Control» لم يعد معروضًا.** على تلك الغسالة أُجيبت صيغتاه بـ«accepted» ولم يتغير شيء: التحكم عن بعد يُضبط من اللوحة. مفتاحه يختفي عند التحديث.
- **المفتاح يبقى في مكانه مدة أطول قليلًا** إذا تأخر إعلان الغسالة، كما تفعل المجموعات. شوهد على تلك الغسالة: «Eco Bubble» ظهر في إعلانها بعد الأمر بخمس عشرة ثانية.
- **إصلاح: تحذير الاسم «Rinse + Spin» بقي** بعد 1.9.0-beta.8 إذا كانت بلاطته أُعيدت تسميتها. الاسم البسيط يُصحَّح الآن دائمًا.

## 1.9.0-beta.8

Trial version on the "beta" channel. Corrections after 1.9.0-beta.7 was tried on a real washer. Your settings, pairings and accessories are kept as they are.

- **Fixed: the settings page opened with no text.** Since 1.9.0-beta.5 one apostrophe inside a text of the page ended its script, so the page showed its boxes and nothing else, on every device. The page's script is now checked on every change.
- **The sliders of 1.9.0-beta.7 are gone.** Apple Home counted a slider as one more thing that is "on" and showed no value on the group's tile, so it did not do what it was added for. The groups are switches only again; the sliders leave on update.
- **Courses can be set from Apple Home on the WA80F16B9CYL top loader**, with remote control off at its panel. The washer refuses the first form and takes the second; the form a washer carried out is now remembered and goes first, so a course is set with one command instead of a refusal and a wait of several seconds.
- **All its course names are now checked at the panel**, course by course: Normal, AI Wash, Quick Wash, Delicates, Hygiene Steam, Bedding, Energy Saving, Rinse and Spin, Tub Clean, Downloaded (87). Course 4D showed "Tub Clean" there as 82 does, so it is named "Tub Clean 4D".
- **Fixed: a name with "+" was refused by Apple Home** ("Rinse + Spin", with a warning in the log). Names are now written with letters, numbers and plain punctuation only.
- **A chosen switch stays where it was put a little longer** when the washer's report is late. Seen on that washer: a course it had taken showed in its report up to 15 seconds after the command, and the switch jumped back meanwhile.

**بالعربية**

إصدار تجريبي على قناة «beta». تصحيحات بعد تجربة 1.9.0-beta.7 على غسالة حقيقية. إعداداتك واقتراناتك وأجهزتك في Apple Home تبقى كما هي.

- **إصلاح: صفحة الإعدادات كانت تفتح بلا نص.** منذ 1.9.0-beta.5 أنهت فاصلة عليا واحدة داخل نص في الصفحة برنامجها، فظهرت الصفحة بمربعاتها فقط على كل الأجهزة. برنامج الصفحة يُفحص الآن مع كل تغيير.
- **أشرطة 1.9.0-beta.7 أُزيلت.** Apple Home عدّ الشريط شيئًا إضافيًا «يعمل» ولم يعرض قيمة على بلاطة المجموعة، فلم يؤدِّ ما أُضيف لأجله. المجموعات مفاتيح فقط كما كانت، والأشرطة تختفي عند التحديث.
- **البرامج تُضبط من Apple Home على الغسالة WA80F16B9CYL**، والتحكم عن بعد مطفأ من لوحتها. الغسالة ترفض الصيغة الأولى وتقبل الثانية، والصيغة التي نفذتها الغسالة تُحفظ الآن وتُرسل أولًا، فيُضبط البرنامج بأمر واحد بدل رفض وانتظار ثوانٍ.
- **كل أسماء برامجها طُوبقت على اللوحة**، برنامجًا برنامجًا: Normal وAI Wash وQuick Wash وDelicates وHygiene Steam وBedding وEnergy Saving وRinse and Spin وTub Clean وDownloaded (87). البرنامج 4D أظهر «Tub Clean» هناك مثل 82، فسُمّي «Tub Clean 4D».
- **إصلاح: الاسم الذي فيه «+» كان يرفضه Apple Home** («Rinse + Spin»، مع تحذير في السجل). الأسماء تُكتب الآن بحروف وأرقام وعلامات بسيطة فقط.
- **المفتاح المختار يبقى في مكانه مدة أطول قليلًا** إذا تأخر إعلان الغسالة. شوهد على تلك الغسالة: برنامج قبلته ظهر في إعلانها بعد الأمر بمدة وصلت إلى 15 ثانية، وكان المفتاح يرجع في الأثناء.

## 1.9.0-beta.7

Trial version on the "beta" channel. More of the washer's panel in the control trial. Your settings, pairings and accessories are kept as they are.

- **Each group also carries a slider that shows the current value**, so the group's tile can show it from outside. It only shows: choosing is done with the switches, and a drag on the slider sends nothing and is put back. For water level the position reads as the washer's own number (level 6 of 10 is 60%); for the other groups it is only a position in the list.
- **New trial switches for the panel's extra buttons**: "Super Speed", "Bubble Soak" and "Bubble Storm", where the washer reports them, and "Smart Control" (remote control; many washers let only the panel set it). None of them has been tried on a washer yet.
- **The log names what is chosen at the washer**: `course selected: 08` for a course, and `option changed: SuperSpeed On` for an extra. With these lines the buttons of a panel can be matched to the washer's own names and numbers, one press at a time.
- **Courses are a group too.** A washer lists its own courses, and that list is now read: one switch per course, the one that is on is the selected course. For the WA80F16B9CYL top loader they carry the names of its panel ("Course Normal", "Course Quick Wash", ...); other models show the course number ("Course 1C") until their names are known. Three of those names were matched in that washer's own log, one is known from other models, and the rest follow the order of its list; its two last courses are shown by number.
- **A course is set in two forms, tried in order.** Seen on that washer: "Course Next" asked for course 02 and was refused, and its list shows why: it has no course 02. Whether a course can be changed from outside is still open. A washer that lists no courses keeps the "next" press.
- Confirmed on that washer with 1.9.0-beta.6: spin level, rinse count, water level and wash time are set from their switches, up and down, each with one command.

**بالعربية**

إصدار تجريبي على قناة «beta». المزيد من لوحة الغسالة في التحكم التجريبي. إعداداتك واقتراناتك وأجهزتك في Apple Home تبقى كما هي.

- **كل مجموعة فيها شريط يعرض القيمة الحالية**، لتظهر على بلاطة المجموعة من الخارج. هو للعرض فقط: الاختيار يكون بالمفاتيح، وسحب الشريط لا يرسل شيئًا ويعود إلى مكانه. في مستوى الماء يُقرأ الموضع كرقم الغسالة (المستوى 6 من 10 هو 60%)، وفي بقية المجموعات هو موضع في القائمة فقط.
- **مفاتيح تجريبية جديدة لأزرار اللوحة الإضافية**: «Super Speed» و«Bubble Soak» و«Bubble Storm» حيث تعلنها الغسالة، و«Smart Control» (التحكم عن بعد، وكثير من الغسالات تسمح بضبطه من اللوحة فقط). لم يُجرَّب أيٌّ منها على غسالة بعد.
- **السجل يذكر ما يُختار من الغسالة**: `course selected: 08` للبرنامج، و`option changed: SuperSpeed On` للإضافة. بهذه السطور تُربط أزرار اللوحة بأسماء الغسالة وأرقامها، ضغطة ضغطة.
- **البرامج صارت مجموعة أيضًا.** الغسالة تعلن قائمة برامجها، وهذه القائمة تُقرأ الآن: مفتاح لكل برنامج، والمفعّل منها هو البرنامج المختار. في الغسالة WA80F16B9CYL تحمل المفاتيح أسماء لوحتها («Course Normal»، «Course Quick Wash»، ...)، وبقية الموديلات تعرض رقم البرنامج («Course 1C») حتى تُعرف أسماؤها. ثلاثة من تلك الأسماء طُوبقت في سجل الغسالة نفسها، وواحد معروف من موديلات أخرى، والبقية تتبع ترتيب قائمتها، وآخر برنامجين فيها يظهران بالرقم.
- **البرنامج يُضبط بصيغتين تُجرَّبان بالترتيب.** شوهد على تلك الغسالة: «Course Next» طلب البرنامج 02 فرُفض، وقائمتها تبيّن السبب: ليس فيها برنامج 02. وما زال مفتوحًا هل يمكن تغيير البرنامج من الخارج. والغسالة التي لا تعلن برامجها تبقى على ضغطة «التالي».
- تأكد على تلك الغسالة مع 1.9.0-beta.6: قوة العصر وعدد الشطف ومستوى الماء ومدة الغسل تُضبط من مفاتيحها صعودًا ونزولًا، بأمر واحد لكل اختيار.

## 1.9.0-beta.6

Trial version on the "beta" channel. Corrections to the groups of switches after 1.9.0-beta.5 was tried on a real washer. Your settings, pairings and accessories are kept as they are.

- **Fixed: a chosen switch could jump back for some seconds, then settle.** A routine reading of the washer that arrived between the command and the washer's own report was taken as "nothing changed": the old value lit up again until the next reading. The plugin now waits for a report that shows the change, or for a reading taken after the command, before it decides; the chosen switch stays on meanwhile and the others stay off.
- **One command at a time.** Commands sent on top of each other made the washer close its connection for about a minute. They now go out one after another, and of several choices for the same setting made in a hurry only the newest is sent.
- **The log says so when a command was accepted and nothing changed**: `accepted, but the washer's report did not change`.
- Seen on that washer during the rinse stage: the rinse count was accepted, reported as changed, and was back at its old value a few minutes later. Whether it holds when set before a cycle starts is not yet known.

**بالعربية**

إصدار تجريبي على قناة «beta». تصحيحات لمجموعات المفاتيح بعد تجربة 1.9.0-beta.5 على غسالة حقيقية. إعداداتك واقتراناتك وأجهزتك في Apple Home تبقى كما هي.

- **إصلاح: المفتاح المختار كان قد يرجع لثوانٍ ثم يستقر.** قراءة دورية للغسالة تصل بين الأمر وإعلان الغسالة كانت تُفهم «لم يتغير شيء»، فتضيء القيمة القديمة حتى القراءة التالية. الآن تنتظر الإضافة إعلانًا يُظهر التغيير، أو قراءة أُخذت بعد الأمر، قبل أن تحكم، ويبقى المفتاح المختار مفعّلًا والبقية مطفأة في الأثناء.
- **أمر واحد في كل مرة.** الأوامر المرسلة فوق بعضها جعلت الغسالة تغلق اتصالها نحو دقيقة. الآن تخرج واحدًا بعد الآخر، ومن عدة اختيارات سريعة للإعداد نفسه يُرسل الأحدث فقط.
- **السجل يذكر متى قُبل الأمر ولم يتغير شيء**: `accepted, but the washer's report did not change`.
- شوهد على تلك الغسالة في مرحلة الشطف: عدد الشطف قُبل وأُعلن متغيرًا، ثم عاد إلى قيمته القديمة بعد دقائق. لم يُعرف بعد هل يثبت إذا ضُبط قبل بدء الدورة.

## 1.9.0-beta.5

Trial version on the "beta" channel. The washer's settings with several values are now groups of switches. Your settings, pairings and accessories are kept as they are.

- **Control trial: a group of switches for each setting.** Water temperature, spin level, rinse count, water level and wash time each appear as switches named after the washer's own values ("Water Hot", "Water Level 6", "Rinse 2", "Spin High"). The one that is on is the current value; switching another on chooses it and the rest go off at once. Switching the current one off is not a command, so it comes back on.
- **Each group is an accessory of its own**, named after the washer and the setting ("... Water Level"). In Apple Home, "Show as Single Tile" keeps a group's switches together in one tile, like a power strip; new groups first appear in the bridge's room.
- **This replaces the sliders of 1.9.0-beta.3 and the "next" press for water temperature**: a slider printed a percentage where the washer shows a number or a name. Their tiles are removed on update.
- A choice is sent the moment its switch is used, without the short wait a slider needed, and several writes of the same choice arriving together are one command.

**بالعربية**

إصدار تجريبي على قناة «beta». إعدادات الغسالة ذات القيم المتعددة صارت مجموعات مفاتيح. إعداداتك واقتراناتك وأجهزتك في Apple Home تبقى كما هي.

- **التحكم التجريبي: مجموعة مفاتيح لكل إعداد.** حرارة الماء وقوة العصر وعدد الشطف ومستوى الماء ومدة الغسل يظهر كل منها مفاتيح بأسماء قيم الغسالة نفسها («Water Hot»، «Water Level 6»، «Rinse 2»، «Spin High»). المفعّل منها هو القيمة الحالية، وتشغيل غيره يختاره وتنطفئ البقية فورًا. إطفاء المفعّل ليس أمرًا، فيعود مفعّلًا.
- **كل مجموعة جهاز مستقل**، اسمه اسم الغسالة مع الإعداد («... Water Level»). خيار «Show as Single Tile» في Apple Home يجمع مفاتيح المجموعة في بلاطة واحدة مثل التوصيلة، والمجموعات الجديدة تظهر أولًا في غرفة الجسر.
- **هذا يحل محل الأشرطة المنزلقة في 1.9.0-beta.3 وضغطة «التالي» لحرارة الماء**: الشريط كان يكتب نسبة مئوية حيث تعرض الغسالة رقمًا أو اسمًا. بلاطاتها تُزال عند التحديث.
- الاختيار يُرسل لحظة استعمال مفتاحه، دون الانتظار القصير الذي كان يحتاجه الشريط، وعدة كتابات للاختيار نفسه تصل معًا تُعد أمرًا واحدًا.

## 1.9.0-beta.4

Trial version on the "beta" channel. Two corrections to the washer control trial after 1.9.0-beta.3 was tried on a real washer. Your settings, pairings and accessories are kept as they are.

- **Water temperature is a press again.** As a slider its lowest value, cold, showed as "off", and the press that had been seen to work was gone. Its values are names (cold, warm, hot), not steps, so a press moves to the next one and round again. Spin level, rinse count, water level and wash time stay sliders.
- **Fixed: the child lock tile could read "Locked" on an open washer.** The washer reports its lock in two forms; on a real top loader the plain one follows the lock both ways, while the other can read as locked when it is not. The plain value now decides wherever the washer gives one.

**بالعربية**

إصدار تجريبي على قناة «beta». تصحيحان للتحكم التجريبي بالغسالة بعد تجربة 1.9.0-beta.3 على غسالة حقيقية. إعداداتك واقتراناتك وأجهزتك في Apple Home تبقى كما هي.

- **حرارة الماء رجعت ضغطة.** كشريط منزلق كانت أقل قيمة، البارد، تظهر «مطفأ»، واختفت الضغطة التي شوهدت تعمل. قيمها أسماء (بارد ودافئ وحار) وليست درجات، فالضغطة تنتقل إلى التالي ثم تدور. قوة العصر وعدد الشطف ومستوى الماء ومدة الغسل تبقى أشرطة منزلقة.
- **إصلاح: بلاطة قفل الأطفال كانت قد تقول «Locked» والغسالة مفتوحة.** الغسالة تعلن قفلها بصيغتين، وعلى غسالة حقيقية تتبع الصيغة البسيطة القفل في الاتجاهين، والأخرى قد تُقرأ مقفلة وهي ليست كذلك. الآن تحسم الصيغة البسيطة حيثما تعطيها الغسالة.

## 1.9.0-beta.3

Trial version on the "beta" channel. Everything in 1.9.0-beta.2, plus what each wash used. Your settings, pairings and accessories are kept as they are.

- **The log says what each cycle used.** At the end of a cycle: `cycle finished; it used 0.5 kWh and 107 L of water`, taken from the washer's own meters at the start and the end of the cycle.
- **The washer's water meter is now read**, and shown in the plugin settings as "Water used so far". The washer does not state the unit; millilitres is inferred from one real top loader and not yet confirmed against another source.
- Apple Home has no tile for energy or water, so these stay in the log and the settings; the total energy remains in the Eve app as before.
- **Control trial: a switch stays where you put it until the washer reports**, so an older reading that arrives in between does not flip it back for a moment.
- **Control trial: levels are now sliders.** Spin level, rinse count, water temperature, water level and wash time each appear as a slider (a fan tile in Apple Home) in place of the "next" press: it goes up and down, shows where the washer stands, and sends the value where it comes to rest. The bottom is the lowest value in the washer's own list and shows as off; Apple Home prints the position as a percentage. Spin level, rinse count, water level, water temperature, wash time and the sound switch were accepted by one real top loader during a cycle, with remote control off at its panel, and its own report changed to match.
- **Fixed: one use of a tile could send a dozen commands.** On a real washer a single use of a switch in Apple Home arrived as up to a dozen writes within a second, and each went to the washer, until it answered "too many commands are waiting". A control now sends one command per use: a press counts once a second and its "off" is never a command, a switch already being set to the same value is left alone, and a slider sends only where it comes to rest.
- **Control trial: a command the washer accepts but does not carry out is followed by its next form.** On a real washer the child lock command was answered "accepted" while its plain report stayed unlocked and the tile read locked, and unlocking did not open it. The trial now checks the washer's report after each accepted form and tries the next one when nothing changed; for the child lock the log shows both of the washer's reports (`false/Ready`). A later log from the same washer shows the lock itself works both ways with the first form once commands are not sent by the dozen; it can always be opened at the washer's panel. On that washer power off and on, the child lock and "stop" (which ends the cycle) work; "pause" is answered "accepted" and ignored in its first form. The washer's code `ErrorCode_CL` is now read as "the child lock is on".
- **A "next course" or "stop" press springs back in under a second**, instead of staying on for about ten seconds until the washer reported.

**بالعربية**

إصدار تجريبي على قناة «beta». كل ما في 1.9.0-beta.2، ومعه استهلاك كل غسلة. إعداداتك واقتراناتك وأجهزتك في Apple Home تبقى كما هي.

- **السجل يذكر استهلاك كل دورة.** عند نهاية الدورة: `cycle finished; it used 0.5 kWh and 107 L of water`، مأخوذة من عدادات الغسالة نفسها في بداية الدورة ونهايتها.
- **عداد الماء في الغسالة يُقرأ الآن**، ويظهر في إعدادات الإضافة باسم «الماء المستهلك حتى الآن». الغسالة لا تذكر الوحدة، والمليلتر مستنتج من غسالة حقيقية واحدة ولم يتأكد بعد من مصدر آخر.
- Apple Home ليس فيه بطاقة للطاقة أو الماء، فتبقى هذه في السجل والإعدادات، وإجمالي الطاقة يبقى في تطبيق Eve كما كان.
- **التحكم التجريبي: المفتاح يبقى حيث وضعته حتى تعلن الغسالة**، فلا تقلبه لحظةً قراءة أقدم تصل في الأثناء.
- **التحكم التجريبي: المستويات صارت أشرطة منزلقة.** قوة العصر وعدد الشطف وحرارة الماء ومستوى الماء ومدة الغسل يظهر كل منها كشريط منزلق (بلاطة مروحة في Apple Home) بدل ضغطة «التالي»: يرتفع وينزل، ويعرض أين تقف الغسالة، ويرسل القيمة التي يستقر عليها. أسفله أقل قيمة في قائمة الغسالة نفسها ويظهر مطفأ، وApple Home يكتب الموضع كنسبة مئوية. قوة العصر وعدد الشطف ومستوى الماء وحرارة الماء ومدة الغسل ومفتاح الصوت قبلتها غسالة حقيقية واحدة أثناء دورة والتحكم عن بعد مطفأ من لوحتها، وتغيّر ما تعلنه ليطابقها.
- **إصلاح: استعمال واحد للبلاطة كان يرسل نحو اثني عشر أمرًا.** على غسالة حقيقية وصل استعمال واحد لمفتاح في Apple Home كاثنتي عشرة كتابة خلال ثانية، وذهبت كلها إلى الغسالة حتى ردّت بأن الأوامر المنتظرة كثيرة. الآن يرسل التحكم أمرًا واحدًا لكل استعمال: الضغطة تُحسب مرة في الثانية وإطفاؤها ليس أمرًا، والمفتاح الذي يُضبط أصلًا على القيمة نفسها يُترك، والشريط المنزلق يرسل فقط حيث يستقر.
- **التحكم التجريبي: الأمر الذي تقبله الغسالة ولا تنفذه يُتبع بصيغته التالية.** على غسالة حقيقية جاء الرد على أمر قفل الأطفال «قُبل» وبقي ما تعلنه بالصيغة البسيطة «غير مقفل» والبلاطة تقول مقفل، والفتح لم يفتحه. التجربة الآن تفحص ما تعلنه الغسالة بعد كل صيغة مقبولة وتجرّب التالية إذا لم يتغير شيء، وفي قفل الأطفال يعرض السجل ما تعلنه الغسالة بالصيغتين (`false/Ready`). سجل لاحق من الغسالة نفسها يُظهر أن القفل يعمل في الاتجاهين بالصيغة الأولى حين لا تُرسل الأوامر بالعشرات، ويمكن فتحه دائمًا من لوحة الغسالة. على تلك الغسالة يعمل الإطفاء والتشغيل وقفل الأطفال و«الإيقاف» (ينهي الدورة)، وأمر «الإيقاف المؤقت» يُجاب «قُبل» ويُتجاهل بصيغته الأولى. رمز الغسالة `ErrorCode_CL` يُقرأ الآن «قفل الأطفال مفعّل».
- **ضغطة «البرنامج التالي» أو «الإيقاف» ترجع في أقل من ثانية**، بدل أن تبقى مشغّلة نحو عشر ثوانٍ حتى تعلن الغسالة.

## 1.9.0-beta.2

Trial version on the "beta" channel. Everything in 1.9.0-beta.1, plus the "finished" notice on a washer that keeps saying it runs, and an unload reminder. Your settings, pairings and accessories are kept as they are.

- **The cycle now ends where the washer's work ends.** A real top loader keeps reporting "Run" with the stage "Finish" (100%) after a cycle, for minutes or hours, until it is switched off. The cycle tile stayed on all that time and the "finished" sensor never turned on. That stage now counts as finished: the tile stops and the sensor turns on once. Checked against the SmartThings app, which says "Cycle complete" at the same minute over two cycles.
- **New, optional: an unload reminder.** A sensor named "Unload" turns on for five minutes every half hour while the washing stays inside, counted from the end of the cycle, and stops when the washer is switched off or a new cycle starts. Off until you tick it. The half hour follows what the SmartThings app does; the reminder is the plugin's own clock, not something the washer sends.
- The washer control trial is unchanged and still not confirmed on any washer.

**بالعربية**

إصدار تجريبي على قناة «beta». كل ما في 1.9.0-beta.1، ومعه إشعار «انتهت» في الغسالة التي تبقى تقول إنها تعمل، وتذكير إخراج الغسيل. إعداداتك واقتراناتك وأجهزتك في Apple Home تبقى كما هي.

- **الدورة تنتهي الآن حيث ينتهي عمل الغسالة.** غسالة حقيقية بتحميل علوي تبقى تعلن «Run» مع المرحلة «Finish» (100%) بعد الدورة، دقائق أو ساعات، حتى تُطفأ. كانت بطاقة الدورة تبقى تعمل طوال ذلك وحساس «انتهت» لا يتفعّل أبدًا. هذه المرحلة تُحسب الآن انتهاءً: البطاقة تتوقف والحساس يتفعّل مرة واحدة. طُوبق ذلك مع تطبيق SmartThings الذي يقول «Cycle complete» في الدقيقة نفسها في دورتين.
- **جديد واختياري: تذكير إخراج الغسيل.** حساس باسم «Unload» يتفعّل خمس دقائق كل نصف ساعة ما دام الغسيل في الداخل، محسوبة من نهاية الدورة، ويتوقف عند إطفاء الغسالة أو بدء دورة جديدة. مطفأ حتى تختاره. نصف الساعة مطابق لما يفعله تطبيق SmartThings، والتذكير من ساعة الإضافة نفسها وليس شيئًا ترسله الغسالة.
- التحكم التجريبي بالغسالة لم يتغير، ولم يتأكد بعد على أي غسالة.

## 1.9.0-beta.1

Trial version on the "beta" channel. A control trial for washers, off by default. Your settings, pairings and accessories are kept as they are.

- **New, trial: washer controls you can tick one by one.** Power, run (start, resume, pause), stop, child lock, sound, and a "next value" press for spin level, rinse count, water temperature, water level, wash time and course. Each ticked control appears in Apple Home as a switch (the child lock as a settable lock).
- **Not yet confirmed on any washer.** The commands are built from what the washer itself reports; none has been sent to a real one before this version. The trial exists to find out what a washer accepts over the local network.
- **The log shows each attempt**: what was sent, what the washer answered, and what it reported before and after, in lines that start with `control trial`.
- Nothing is sent unless a control is ticked and its switch is used. Models differ: untick a control that does nothing on yours. The run switch can start a cycle.

**بالعربية**

إصدار تجريبي على قناة «beta». تحكم تجريبي بالغسالات، مطفأ افتراضيًا. إعداداتك واقتراناتك وأجهزتك في Apple Home تبقى كما هي.

- **جديد وتجريبي: تحكمات للغسالة تختارها واحدًا واحدًا.** التشغيل والإطفاء، الدورة (بدء وإكمال وإيقاف مؤقت)، الإيقاف، قفل الأطفال، الصوت، وضغطة «القيمة التالية» لقوة العصر وعدد الشطف وحرارة الماء ومستوى الماء ومدة الغسل والبرنامج. كل تحكم تختاره يظهر في Apple Home كمفتاح (وقفل الأطفال كقفل قابل للضبط).
- **لم يتأكد بعد على أي غسالة.** الأوامر مبنية مما تعلنه الغسالة نفسها، ولم يُرسل أي منها إلى غسالة حقيقية قبل هذا الإصدار. الغرض معرفة ما تقبله الغسالة عبر الشبكة المحلية.
- **السجل يعرض كل محاولة**: ما أُرسل، وبماذا ردّت الغسالة، وما أعلنته قبل وبعد، في سطور تبدأ بـ `control trial`.
- لا يُرسل شيء إلا إذا اخترت التحكم واستعملت مفتاحه. الموديلات تختلف: أزل علامة التحكم الذي لا يعمل معك. مفتاح الدورة قد يبدأ دورة غسيل.

## 1.8.12

An air conditioner no longer beeps twice for one command. Your settings, pairings and accessories are kept as they are.

- **A command the appliance answers with 4.00 is no longer sent again at once.** On a real air conditioner a correct power command was now and then answered 4.00 and repeated 0.6 s later, and the unit was heard to beep twice. The plugin now waits for the reading both engines already make 4 s after any command; when that reading shows the command was carried out, nothing more is sent, and the log says so. That the unit carries the command out despite its 4.00 answer is inferred from the two beeps, not measured.
- **The command is sent once more only when that reading does not show it**, or when no reading arrives within 7 s. In that rare case the second attempt comes about 4 s later than before; every other command is as fast as it was.
- No extra question goes to the appliance, and the quiet time after a command is unchanged. Both engines behave the same.

**بالعربية**

المكيف لا يصفّر مرتين لأمر واحد. إعداداتك واقتراناتك وأجهزتك في Apple Home تبقى كما هي.

- **الأمر الذي يردّ عليه الجهاز بـ 4.00 لا يُعاد إرساله فورًا.** على مكيف حقيقي كان أمر التشغيل الصحيح يُجاب أحيانًا بـ 4.00 فيُعاد بعد 0.6 ثانية، وسُمع المكيف يصفّر مرتين. الإضافة الآن تنتظر القراءة التي يجريها المحركان أصلًا بعد 4 ثوانٍ من أي أمر؛ فإذا أظهرت أن الأمر نُفّذ لا يُرسل شيء آخر، ويُكتب ذلك في السجل. تنفيذ المكيف للأمر مع ردّه بـ 4.00 مستنتج من الصوتين، وليس مقيسًا.
- **يُعاد الأمر مرة واحدة فقط إذا لم تُظهره تلك القراءة**، أو لم تصل قراءة خلال 7 ثوانٍ. في هذه الحالة النادرة تأتي المحاولة الثانية أبطأ بنحو 4 ثوانٍ من السابق، وبقية الأوامر بسرعتها كما كانت.
- لا يُرسل للجهاز أي سؤال إضافي، وفترة الهدوء بعد الأمر باقية كما هي. المحركان يتصرفان بالطريقة نفسها.

## 1.8.11

The SmartThings button on iPhone and iPad hands the address to Safari. Your settings, pairings and accessories are kept as they are.

- **On an iPhone or iPad the button hands the address to the system, which opens the tokens page in Safari as if typed.** On a real iPad already signed in to Samsung, the page still ended in Samsung's error page (403) when reached by a link, also through SmartThings' own guide in a normal tab; the same address opened when another app handed it to Safari. The hand-over is now made from the Homebridge page itself; earlier attempts made it from inside the sandboxed settings frame, which may not start it.
- **If the system does not take the address, the button turns into the way through SmartThings' own guide**, which stays the way on every other device.
- The help under the button says plainly that the error page is Samsung's side, and keeps the direct address with a copy button.

**بالعربية**

زر SmartThings على iPhone و iPad يسلّم العنوان إلى Safari. إعداداتك واقتراناتك وأجهزتك في Apple Home تبقى كما هي.

- **على iPhone و iPad يسلّم الزر العنوان إلى النظام، فيفتح صفحة الرموز في Safari كأنه مكتوب.** على iPad حقيقي داخل إلى Samsung بقيت الصفحة تنتهي بصفحة خطأ Samsung (403) إذا وصلتها برابط، حتى عن طريق شرح SmartThings نفسه وفي تبويب عادي. والعنوان نفسه فتح حين سلّمه تطبيق آخر إلى Safari. التسليم الآن يخرج من صفحة Homebridge نفسها، والمحاولات السابقة كانت من داخل إطار الإعدادات المقيّد، وهو لا يُسمح له ببدئه.
- **إذا لم يأخذ النظام العنوان، يتحول الزر إلى الطريق عن طريق شرح SmartThings**، وهو الطريق على بقية الأجهزة.
- المساعدة تحت الزر تقول بوضوح إن صفحة الخطأ من جهة Samsung، وتُبقي العنوان المباشر مع زر نسخ.

## 1.8.10

The SmartThings button also works for a browser already signed in to Samsung. Your settings, pairings and accessories are kept as they are.

- **The button opens SmartThings' own guide in a normal tab, and the tokens page is opened from its link there.** With 1.8.9 the tokens page opened for a browser not yet signed in to Samsung, and ended in Samsung's error page (403) once it was signed in; this was seen on a real iPhone and iPad. Opened from the link inside SmartThings' own guide, in a normal tab, it opens either way. The two fixes work together: the normal tab of 1.8.9 and the guide of 1.8.8.
- The direct address stays in the help under the button, as a link and with a copy button.

**بالعربية**

زر SmartThings يعمل أيضًا لمتصفح داخل إلى Samsung من قبل. إعداداتك واقتراناتك وأجهزتك في Apple Home تبقى كما هي.

- **الزر يفتح شرح SmartThings الرسمي في تبويب عادي، وصفحة الرموز تُفتح من رابطه هناك.** في 1.8.9 كانت صفحة الرموز تفتح لمتصفح لم يدخل إلى Samsung بعد، وتنتهي بصفحة خطأ Samsung (403) بعد دخوله. شوهد هذا على iPhone و iPad حقيقيين. وإذا فُتحت من الرابط الذي داخل شرح SmartThings نفسه، في تبويب عادي، تفتح في الحالتين. الإصلاحان يعملان معًا: التبويب العادي من 1.8.9، والشرح من 1.8.8.
- العنوان المباشر باقٍ في المساعدة تحت الزر، رابطًا ومعه زر نسخ.

## 1.8.9

The SmartThings button opens a normal tab. Your settings, pairings and accessories are kept as they are.

- **One tap opens the tokens page in a normal tab.** The settings page runs in a sandboxed frame inside Homebridge; a tab opened from inside it inherits the frame's limits, and so does every tab opened from that one, which is why Samsung's sign-in ended in its error page (403) even through SmartThings' own guide. The tap is now passed to a link in the Homebridge page itself, which has no such limits.
- The button goes straight to the tokens page again, the same on every device. The help under it keeps the address as a link, with a copy button, and shows how the page was last opened.

**بالعربية**

زر SmartThings يفتح تبويبًا عاديًا. إعداداتك واقتراناتك وأجهزتك في Apple Home تبقى كما هي.

- **ضغطة واحدة تفتح صفحة الرموز في تبويب عادي.** صفحة الإعدادات تعمل داخل إطار مقيّد في Homebridge، والتبويب الذي يُفتح من داخله يرث قيوده، وكذلك كل تبويب يُفتح منه بعد ذلك. لهذا انتهت صفحة الدخول في Samsung بصفحة الخطأ (403) حتى عن طريق شرح SmartThings نفسه. الآن تُمرَّر الضغطة إلى رابط في صفحة Homebridge نفسها، وهي بلا تلك القيود.
- الزر يذهب مباشرة إلى صفحة الرموز من جديد، وهو نفسه على كل الأجهزة. والمساعدة تحته تُبقي العنوان رابطًا ومعه زر نسخ، وتعرض كيف فُتحت الصفحة آخر مرة.

## 1.8.8

The way to the SmartThings tokens page that works on an iPhone. Your settings, pairings and accessories are kept as they are.

- **The button opens SmartThings' own guide to personal access tokens, and the tokens page is opened from its link there.** Opened straight from the settings page, the tokens page could end in an error page from Samsung (403); opened from the link inside SmartThings' own guide it opens. This was tested on a real iPhone before the release.
- **The Safari address of 1.8.7 is removed:** it did not open from inside the settings page. The button is a plain link, the same on every device.
- The direct address stays in the help under the button, as a link and with a copy button.

**بالعربية**

الطريق إلى صفحة الرموز في SmartThings الذي يعمل على iPhone. إعداداتك واقتراناتك وأجهزتك في Apple Home تبقى كما هي.

- **الزر يفتح شرح SmartThings الرسمي للرموز الشخصية، وصفحة الرموز تُفتح من رابطه هناك.** إذا فُتحت صفحة الرموز من صفحة الإعدادات مباشرة فقد تنتهي بصفحة خطأ من Samsung (403)، وإذا فُتحت من الرابط الذي داخل شرح SmartThings نفسه تفتح. جُرّب هذا على iPhone حقيقي قبل الإصدار.
- **حُذف عنوان Safari الذي في 1.8.7:** لم يفتح من داخل صفحة الإعدادات. والزر رابط عادي، وهو نفسه على كل الأجهزة.
- العنوان المباشر باقٍ في المساعدة تحت الزر، رابطًا ومعه زر نسخ.

## 1.8.7

The SmartThings button opens the form that creates a token. Your settings, pairings and accessories are kept as they are.

- **One button that picks its address by the device.** On an iPhone or iPad it is "Create token in Safari": a plain link that asks the system to open the form in Safari itself, from your own tap. Elsewhere it is "Create SmartThings token" and opens the form in a new tab.
- **It goes straight to the form that creates a token** (`account.smartthings.com/tokens/new`), and the three steps say so: open the form, tick the read permissions, create the token and paste it.
- **The help under the button keeps the other ways** for when Samsung shows an error page: press and hold for "Open in New Tab", or copy the address. The scripted attempt of 1.8.6 is removed.

**بالعربية**

زر SmartThings يفتح نموذج إنشاء الرمز. إعداداتك واقتراناتك وأجهزتك في Apple Home تبقى كما هي.

- **زر واحد يختار عنوانه بحسب الجهاز.** على iPhone و iPad اسمه «إنشاء رمز في Safari»: رابط عادي يطلب من النظام فتح النموذج في Safari نفسه، من ضغطتك أنت. وعلى بقية الأجهزة اسمه «إنشاء رمز في SmartThings»، ويفتح النموذج في تبويب جديد.
- **يذهب مباشرة إلى نموذج إنشاء الرمز** (`account.smartthings.com/tokens/new`)، والخطوات الثلاث تقول ذلك: افتح النموذج، ثم اختر صلاحيات القراءة، ثم أنشئ الرمز والصقه.
- **المساعدة تحت الزر تُبقي الطرق الأخرى** إذا عرضت Samsung صفحة خطأ: الضغط المطوّل ثم «فتح في علامة تبويب جديدة»، أو نسخ العنوان. ومحاولة 1.8.6 بالسكربت حُذفت.

## 1.8.6

The SmartThings button on iPhone and iPad. Your settings, pairings and accessories are kept as they are.

- **On an iPhone or iPad the SmartThings button hands the address to the system, which opens it in Safari as if typed.** Samsung's sign-in refuses (error 403) a page reached by a link when the browser is already signed in to Samsung, although the same address opens when typed, pasted, or opened with "Open in New Tab"; this was confirmed on a real iPhone. If the system does not take it, the help under the button opens by itself.
- **The help under the button names what works everywhere:** press and hold the button and choose "Open in New Tab", or copy the address.

**بالعربية**

زر SmartThings على iPhone و iPad. إعداداتك واقتراناتك وأجهزتك في Apple Home تبقى كما هي.

- **على iPhone و iPad يسلّم زر SmartThings العنوان إلى النظام، فيفتحه في Safari كأنه مكتوب.** صفحة الدخول في Samsung ترفض (الخطأ 403) الصفحة التي تصلها برابط إذا كان المتصفح داخلًا إلى حساب Samsung، مع أن العنوان نفسه يفتح إذا كُتب أو لُصق أو فُتح بـ«فتح في علامة تبويب جديدة». تأكد هذا على iPhone حقيقي. وإذا لم يأخذه النظام تنفتح المساعدة تحت الزر تلقائيًا.
- **المساعدة تحت الزر تذكر ما ينجح في كل مكان:** اضغط مطولًا على الزر واختر «فتح في علامة تبويب جديدة»، أو انسخ العنوان.

## 1.8.5

Help for the SmartThings sign-in. Your settings, pairings and accessories are kept as they are.

- **The SmartThings button opens the page from the Homebridge window itself**, not from inside the settings frame: opened from inside the frame, Samsung's sign-in could refuse it with error 403 although the same address opens when typed.
- **When Samsung's sign-in shows an error page** (such as 403) instead of the tokens page, the step now says what to do: press the button once more, open the address in a private window or another browser, or create the token on a computer. With a button that copies the address.
- **The first step reads in order:** the button that opens the page, then what to press on that page.

**بالعربية**

مساعدة عند الدخول إلى SmartThings. إعداداتك واقتراناتك وأجهزتك في Apple Home تبقى كما هي.

- **زر SmartThings يفتح الصفحة من نافذة Homebridge نفسها**، لا من داخل إطار الإعدادات: فتحها من داخل الإطار قد يجعل صفحة الدخول في Samsung ترفضها بالخطأ 403، مع أن العنوان نفسه يفتح إذا كُتب مباشرة.
- **إذا عرضت صفحة الدخول في Samsung خطأ** (مثل 403) بدل صفحة الرموز، تشرح الخطوة ما تفعله: اضغط الزر مرة ثانية، أو افتح العنوان في نافذة خاصة أو متصفح آخر، أو أنشئ الرمز من كمبيوتر. ومعها زر ينسخ العنوان.
- **الخطوة الأولى صارت بالترتيب:** الزر الذي يفتح الصفحة، ثم ما تضغطه في تلك الصفحة.

## 1.8.4

Two accuracy fixes from a review of 1.8.3. Your settings, pairings and accessories are kept as they are.

- **A TV at home no longer takes the name of the same model at the office.** A SmartThings appliance you ignored, or one in another SmartThings place, is now matched by its own ID only; a like model or name is not enough, and linking by hand from the list stays possible. The same appliance moved home is still known by its ID.
- **"No Response" on every tile of an appliance that is not reachable**, not only the first one: a refrigerator's temperature setting, a filter, a lock or a battery tile say so too.

**بالعربية**

إصلاحان في الدقة بعد مراجعة 1.8.3. إعداداتك واقتراناتك وأجهزتك في Apple Home تبقى كما هي.

- **تلفزيون البيت لم يعد يأخذ اسم تلفزيون المكتب إذا تشابه الموديل.** الجهاز الذي تجاهلته في SmartThings، أو الذي في موقع آخر فيه، يطابق الآن بمعرّفه فقط. تشابه الموديل أو الاسم لا يكفي، ويبقى الربط اليدوي من القائمة ممكنًا. والجهاز نفسه إذا نُقل إلى البيت يُعرف بمعرّفه كما كان.
- **«لا يستجيب» على كل بطاقات الجهاز المنقطع**، لا على الأولى فقط: ضبط حرارة الثلاجة، والفلتر، والقفل، والبطارية، كلها تقولها.

## 1.8.3

One more choice in the scan result. Your settings, pairings and accessories are kept as they are.

- **"Ignore it" on a SmartThings appliance that is not in this home** (a screen at the office): it leaves the list of missing ones and is remembered, also after a new import. If it answers on this network one day, it shows up like any other. "Show it again" brings it back.

**بالعربية**

خيار إضافي في نتيجة البحث. إعداداتك واقتراناتك وأجهزتك في Apple Home تبقى كما هي.

- **زر «تجاهله» على جهاز في SmartThings ليس في هذا البيت** (شاشة في المكتب): يخرج من قائمة الغائبين ويُحفظ اختيارك، حتى بعد استيراد جديد. وإذا رد يومًا على هذه الشبكة يظهر مثل أي جهاز آخر. و«أظهره من جديد» يعيده.

## 1.8.2

A small fix in the scan result. Your settings, pairings and accessories are kept as they are.

- **"Why, and what to check" is a row of its own under the buttons**, with space around it, so a finger no longer opens it instead of "Search for it", or the other way round.
- **The plugin page shows the SmartThings names step by step in pictures:** the bar, the import, the progress, the result with its decision bar, and the search for one appliance.

**بالعربية**

إصلاح صغير في نتيجة البحث. إعداداتك واقتراناتك وأجهزتك في Apple Home تبقى كما هي.

- **سطر «لماذا، وماذا أتحقق منه» صار في صف مستقل تحت الأزرار**، وحوله مسافة، فلا يفتحه الإصبع بالغلط بدل «ابحث عنه»، ولا العكس.
- **صفحة الإضافة تشرح الأسماء من SmartThings بالصور خطوة خطوة:** الشريط، ثم الاستيراد، ثم التقدم، ثم النتيجة وشريط القرار، ثم البحث عن جهاز واحد.

## 1.8.1

Names from SmartThings, after a first run in a real home: a scan that shows its work and keeps its result. Your settings, pairings and accessories are kept as they are.

- **Tested in a real home:** five air conditioners and a washer were matched to their SmartThings names by their own ID.
- **A progress bar with stages:** connect to SmartThings, import, scan the network, match; an ordinary scan shows scan and read. With the time passed, the appliance being read, and Stop.
- **The result stays on the page.** A new scan adds to it and never clears it: what was found stays with its match even when it does not answer the next time ("not answering now"), and what is found now is marked. A name being typed keeps its place.
- **Search for one appliance only**, up to three times, stopping when it is found; **Watch for them** keeps looking for a few minutes, so an appliance switched on meanwhile shows up by itself. An appliance that fails to be read is asked a second time by itself, and the scan takes a second look when SmartThings shows an appliance online that did not answer.
- **One decision bar:** new appliances are ticked with their names; an appliance already in your list takes its SmartThings name only where you tick it; Apply selected, Select all, Clear all.
- **The imported list is kept on your own Homebridge** (names, rooms, models, IDs; never the token; sent nowhere), so a later scan, or adding by address, matches without connecting to SmartThings again. A later import is joined with it; "Forget the import" and deleting the plugin's data remove it.
- **Smarter matching:** also by SmartThings' own ID of the appliance, by a model spelled longer on one side, and by name for an appliance already in your list that is off now. An appliance in another SmartThings place, such as an office, is folded as not expected on this network.
- **The SmartThings button opens the tokens page at its own stable address** (`account.smartthings.com/tokens`), which asks for the Samsung sign-in when needed. "Import and scan" is greyed with a wheel after it is pressed, until the work is over. The import is a clear bar of its own, closed until opened.
- **The page reads from top to bottom for a new setup:** 1 · the engine, 2 · adding (A names from SmartThings if wanted, B the automatic scan, C one address by hand), then the two last steps (child bridge, Home app) repeated under the appliance list beside SAVE.
- **Every push checks that the outside links on the settings page still open.**
- **The plugin page and its description in Homebridge say it plainly:** SmartThings is only an option, used once, to bring names and rooms over automatically; the plugin never depends on it.
- The ordinary scan without SmartThings works as before, with names from this plugin and from `homebridge-smartthings-oauth`.

**بالعربية**

الأسماء من SmartThings بعد أول تجربة في بيت حقيقي: بحث يُظهر عمله ويحفظ نتيجته. إعداداتك واقتراناتك وأجهزتك في Apple Home تبقى كما هي.

- **جُرّب في بيت حقيقي:** تطابقت خمسة مكيفات وغسالة مع أسمائها في SmartThings بمعرّفها.
- **شريط تقدّم بمراحل:** الاتصال بـ SmartThings، ثم الاستيراد، ثم مسح الشبكة، ثم المطابقة. والبحث العادي يعرض المسح والقراءة. ومعه الوقت المنقضي، والجهاز الذي يُقرأ الآن، وزر الإيقاف.
- **النتيجة تبقى في الصفحة.** البحث الجديد يضيف إليها ولا يمسحها: ما وُجد يبقى بمطابقته حتى لو لم يرد في المرة التالية («لم يرد الآن»)، وما يوجد الآن عليه علامة. والاسم الذي تكتبه يبقى في مكانه.
- **البحث عن جهاز واحد فقط** حتى ثلاث محاولات، ويتوقف حين يجده. وزر **راقب حتى تظهر** يواصل البحث دقائق، فالجهاز الذي تشغّله يظهر وحده. والجهاز الذي تتعذر قراءته يُسأل مرة ثانية تلقائيًا، ويعيد البحث النظر مرة ثانية إذا ظهر في SmartThings جهاز متصل لم يرد.
- **شريط واحد للقرار:** الأجهزة الجديدة محددة بأسمائها، والجهاز الذي في قائمتك يأخذ اسمه من SmartThings حيث تحدده فقط. وفيه: طبّق المحدد، وحدد الكل، وألغِ الكل.
- **القائمة المستوردة تُحفظ على Homebridge عندك** (الأسماء والغرف والموديلات والمعرّفات، دون الرمز، ولا تُرسل إلى أي مكان)، فيطابق بها البحث اللاحق والإضافة بالعنوان دون اتصال جديد بـ SmartThings. والاستيراد اللاحق يُدمج معها، و«تجاهل الاستيراد» و«حذف بيانات هذه الإضافة» يحذفانها.
- **مطابقة أذكى:** بمعرّف الجهاز في SmartThings نفسه أيضًا، وبالموديل المكتوب أطول في إحدى الجهتين، وبالاسم للجهاز الذي في قائمتك وهو مطفأ الآن. والجهاز الذي في موقع آخر في SmartThings، مثل المكتب، يُطوى لأنه لا يُنتظر على هذه الشبكة.
- **زر SmartThings يفتح صفحة الرموز بعنوانها الثابت** (`account.smartthings.com/tokens`)، وهي تطلب الدخول بحساب Samsung عند الحاجة. وزر «استورد وابحث في الشبكة» يصير باهتًا وعليه علامة دوران بعد ضغطه، حتى ينتهي العمل. والاستيراد شريط واضح مستقل، مطوي حتى تفتحه.
- **الصفحة تُقرأ من الأعلى إلى الأسفل في الإعداد الجديد:** 1 · المحرك، ثم 2 · الإضافة (أ الأسماء من SmartThings إن أردتها، ب المسح التلقائي، ج عنوان واحد يدويًا)، ثم الخطوتان الأخيرتان (الجسر الفرعي وتطبيق Home) مكررتان تحت قائمة الأجهزة بجانب SAVE.
- **كل رفع للتعديلات يتحقق أن الروابط الخارجية في صفحة الإعدادات ما زالت تعمل.**
- **صفحة الإضافة ووصفها في Homebridge يقولان ذلك بوضوح:** SmartThings خيار فقط، يُستعمل مرة واحدة لجلب الأسماء والغرف تلقائيًا، ولا تعتمد عليه الإضافة أبدًا.
- البحث العادي دون SmartThings يعمل كما كان، بالأسماء من هذه الإضافة ومن `homebridge-smartthings-oauth`.

## 1.8.0

Names from SmartThings, optional and once. Your settings, pairings and accessories are kept as they are.

- **Optional: your appliance names from SmartThings.** Only to name your appliances and match them with what the scan finds, once: paste a SmartThings token you create yourself, and the names and rooms you gave your appliances there come over. The token is used for these few reads and forgotten (not in a file, not in the log). Nothing is controlled through SmartThings, and the plugin does not connect to it again. You do not need it to use the plugin.
- **The two lists side by side.** In SmartThings and on the network (matched by the appliance's own ID, or by model when only one of that model is left on each side); on the network only (pick its name from the SmartThings names left over); in SmartThings only (did not answer, with what to check and Scan the network again). Cloud-only appliances such as sensors are folded into one line.
- **Subject to Samsung's policies.** The import uses Samsung's SmartThings service, so it follows Samsung's terms and policies; Samsung has announced that from 15 December 2026 these tokens need a paid SmartThings API plan. The rest of the plugin does not depend on it.
- **A TV already in the list shows the name you gave it in the scan**, as air conditioners already did, instead of the name the TV reports.
- **The plugin page explains naming in full:** only a name you give is remembered; a suggestion left as it is is used but not remembered; numbered suggestions take the smallest number not in use; deleting the plugin's data clears the remembered names.

**بالعربية**

الأسماء من SmartThings، اختياريًا ومرة واحدة. إعداداتك واقتراناتك وأجهزتك في Apple Home تبقى كما هي.

- **اختياري: أسماء أجهزتك من SmartThings.** هدفه تسمية أجهزتك ومطابقتها بما يجده البحث في الشبكة، مرة واحدة فقط: تلصق رمزًا تنشئه بنفسك في SmartThings، فتنتقل الأسماء والغرف التي أعطيتها لأجهزتك هناك. يُستعمل الرمز لهذه القراءة ثم يُنسى، فلا يُحفظ في ملف ولا يظهر في السجل. لا تتحكم الإضافة بأي جهاز عن طريق SmartThings، ولا تتصل به مرة أخرى. ولا تحتاجه لاستعمال الإضافة.
- **القائمتان جنبًا إلى جنب.** في SmartThings وفي الشبكة (المطابقة بمعرّف الجهاز نفسه، أو بالموديل إذا بقي جهاز واحد منه في كل جهة)؛ في الشبكة فقط (تختار اسمه من أسماء SmartThings الباقية)؛ في SmartThings فقط (لم يرد، ومعه ما تتحقق منه وزر إعادة البحث). والأجهزة السحابية فقط مثل الحساسات مطوية في سطر واحد.
- **يخضع لسياسات Samsung.** يستعمل الاستيراد خدمة SmartThings من Samsung، فهو يخضع لشروطها وسياساتها، وقد أعلنت Samsung أن هذه الرموز تحتاج خطة SmartThings API مدفوعة من 15 ديسمبر 2026. وبقية الإضافة لا تعتمد عليه.
- **التلفزيون المضاف من قبل يظهر في نتائج البحث بالاسم الذي أعطيته له**، كما كانت المكيفات تظهر، بدل الاسم الذي يرسله التلفزيون.
- **صفحة الإضافة تشرح التسمية كاملة:** يُحفظ فقط الاسم الذي تعطيه أنت، والاسم المقترح إذا تركته كما هو يُستعمل ولا يُحفظ، والاسم المرقّم يأخذ أصغر رقم غير مستعمل، و«حذف بيانات هذه الإضافة» يمسح الأسماء المحفوظة.

## 1.7.0

Appliances come with names. Your settings, pairings and accessories are kept as they are.

- **A name for every appliance found, with where it comes from.** Air conditioners and washers do not keep their SmartThings name (it lives in Samsung's cloud) and send only their model, so one added without a name used to be called by its model code, the same for every unit. Now each one gets a name to start from, shown with its source: "its earlier name here", "from homebridge-smartthings-oauth" (when that plugin kept the same ID; read only), "from the appliance" (TVs), or a suggested name such as "Air conditioner 1" or "Washer". Numbering takes the smallest number not used by the appliances there now, so it starts again at 1 when the earlier ones were given names of their own.
- **The network scan names every appliance before adding.** Each one found has its own name field, and what it is doing now (on, mode, set temperature) to tell which unit is in which room: switch one on and see which line changes.
- **The last name is remembered after removal.** Only a name given is kept: a suggested name left as it was (numbered, or a TV's own) is used but not remembered, and the name typed later replaces it. The name given in the settings is kept in the plugin's own folder under the appliance's stable ID (its MAC address too), so an appliance removed and added again comes back with its latest name. "Delete this plugin's data" removes the remembered names too. Names changed in the Home app stay in the Home app, as before.

**بالعربية**

الأجهزة تأتي بأسمائها. إعداداتك واقتراناتك وأجهزتك في Apple Home تبقى كما هي.

- **اسم لكل جهاز يُعثر عليه، ومعه مصدره.** المكيفات والغسالات لا تحتفظ باسمها في SmartThings (فهو محفوظ في سحابة Samsung) وترسل الموديل فقط، فكان الجهاز المضاف دون اسم يُسمّى برمز موديله، وهو الرمز نفسه لكل الوحدات. صار كل جهاز يأتي باسم تبدأ منه، ومعه مصدره: «اسمه السابق في هذه الإضافة»، أو «من homebridge-smartthings-oauth» (إن حفظت تلك الإضافة المعرّف نفسه؛ للقراءة فقط)، أو «من بيانات الجهاز» (التلفزيونات)، أو «اسم مقترح» مثل «مكيف 1» و«غسالة». والترقيم يأخذ أصغر رقم غير مستعمل بين أسماء الأجهزة الموجودة الآن، فيبدأ من 1 من جديد إذا كانت الأسماء السابقة مكتوبة بيدك.
- **البحث في الشبكة يسمّي كل جهاز قبل الإضافة.** لكل جهاز يُعثر عليه خانة اسم خاصة به، ومعها ما يفعله الآن (يعمل، الوضع، الحرارة المضبوطة) لتعرف أي وحدة في أي غرفة: شغّل واحدًا وانظر أي سطر تغيّر.
- **آخر اسم يبقى محفوظًا بعد الحذف.** يُحفظ الاسم الذي تكتبه فقط: الاسم المقترح الذي يبقى كما هو (المرقّم، أو اسم التلفزيون نفسه) يُستعمل ولا يُحفظ، والاسم الذي تكتبه بعده يحل محله. والاسم الذي تكتبه في الإعدادات يُحفظ في مجلد الإضافة بمعرّف الجهاز الثابت (وعنوان MAC أيضًا)، فالجهاز المحذوف إذا أُضيف مرة أخرى يعود بآخر اسم له. و«حذف بيانات الإضافة» يمسح الأسماء المحفوظة أيضًا. والأسماء التي تغيّرها من تطبيق Home تبقى في تطبيق Home كما من قبل.

## 1.6.7

The plugin page says first what matters most. Nothing changes in what the plugin does; your settings, pairings and accessories are kept as they are.

- **Three lines at the very top of the plugin page:** no SmartThings API (no sign-in, token, API or subscription; not built on SmartThings OAuth, so it works where the SmartThings API is not offered), works at home from the first minute, and away from home from the first day with an Apple home hub. A short line under them says what the appliances need: air conditioners and washers on your Wi-Fi, set up once by Samsung's SmartThings app; TVs nothing but "Allow".
- **The npm and Homebridge search description starts with "No SmartThings account sign-in, API or token".**
- **HomeView is named among the Apple home hubs**, beside Apple TV and HomePod, on the page and in the TV settings.
- **The appliance list on the page shows the list as it looks now**, grouped by kind, with TVs linked to Homebridge.

**بالعربية**

صفحة الإضافة تقول أولًا أهم ما فيها. لا يتغير شيء فيما تفعله الإضافة، وإعداداتك واقتراناتك وأجهزتك في Apple Home تبقى كما هي.

- **ثلاثة أسطر في أعلى صفحة الإضافة:** دون API من SmartThings (لا تسجيل دخول ولا رمز ولا API ولا اشتراك؛ ليست مبنية على OAuth من SmartThings، فتعمل حيث لا تتوفر خدمة SmartThings API)، وتعمل داخل البيت من أول دقيقة، ومن خارجه من أول يوم مع مركز منزلي من Apple. وتحتها سطر قصير بما تحتاجه الأجهزة: المكيفات والغسالات على شبكة Wi-Fi البيت، تضبطها Samsung مرة واحدة بتطبيق SmartThings؛ والتلفزيونات لا تحتاج إلا «Allow».
- **وصف npm وبحث Homebridge يبدأ بعبارة «No SmartThings account sign-in, API or token».**
- **HomeView صار مذكورًا بين المراكز المنزلية من Apple**، بجانب Apple TV و HomePod، في الصفحة وفي إعدادات التلفزيون.
- **صورة قائمة الأجهزة في الصفحة تعرض القائمة كما هي الآن**، مصنّفة حسب النوع، والتلفزيونات مرتبطة بـ Homebridge.

## 1.6.6

The two links of a TV, named for what they are. Nothing changes in what the TV does; your settings, pairings and accessories are kept as they are.

- **The link between Homebridge and the TV sits beside the TV's name.** It is the TV's answer to "Allow", the first link and the base of everything else: "linked to Homebridge" in green, or "not linked to Homebridge" in red. It follows what the TV last answered, when linked from the settings and with every press. "Link to Homebridge again" stays at the top of the options.
- **Each link has a small drawing of its own:** a bridge beside the Homebridge link, a house beside the HomeKit link.
- **The link with HomeKit sits beside the TV tile**, with its scan picture and code: "linked to HomeKit" in green, or "not linked to HomeKit" in yellow with the code under it. It follows HomeKit itself: a tile removed in the Home app shows as not linked.

**بالعربية**

ارتباطا التلفزيون، وكل واحد باسمه. لا يتغير شيء فيما يفعله التلفزيون، وإعداداتك واقتراناتك وأجهزتك في Apple Home تبقى كما هي.

- **الارتباط بين Homebridge والتلفزيون يظهر بجانب اسم التلفزيون.** هو موافقة التلفزيون بـ «Allow»، الارتباط الأول وأساس كل شيء: «مرتبط بـ Homebridge» بالأخضر، أو «غير مرتبط بـ Homebridge» بالأحمر. ويتبع آخر جواب من التلفزيون، عند الربط من الإعدادات ومع كل ضغطة. و«اربطه بـ Homebridge من جديد» باقٍ أعلى الخيارات.
- **لكل ارتباط رسم صغير خاص به:** جسر بجانب ارتباط Homebridge، وبيت بجانب ارتباط HomeKit.
- **الارتباط مع HomeKit يظهر بجانب بطاقة التلفزيون**، مع صورة المسح والرمز: «مربوط بـ HomeKit» بالأخضر، أو «غير مربوط بـ HomeKit» بالأصفر والرمز تحتها. ويتبع HomeKit نفسه: البطاقة المحذوفة من تطبيق Home تظهر غير مربوطة.

## 1.6.5

Clearer TV settings. Nothing changes in what the TV does; your settings, pairings and accessories are kept as they are.

- **Two different pairings, each said for what it is.** The line "Paired with the TV" sat in the "In the Home app" group and read like a pairing with Apple Home, though it is the TV's own permission for this plugin. It is back at the top as "Permission from the TV for this plugin: allowed", with "Ask the TV again".
- **Whether the TV tile is in Apple Home is shown beside its name:** "Added to Apple Home", or "not in Apple Home" with its code under it. It follows Apple Home itself: a tile removed there shows as not added.

**بالعربية**

إعدادات تلفزيون أوضح. لا يتغير شيء فيما يفعله التلفزيون، وإعداداتك واقتراناتك وأجهزتك في Apple Home تبقى كما هي.

- **اقترانان مختلفان، وكل واحد باسمه.** سطر «تم الاقتران مع التلفزيون» كان داخل مجموعة «في تطبيق Home»، فبدا كأنه اقتران مع Apple Home، وهو في الحقيقة إذن التلفزيون نفسه لهذه الإضافة. عاد إلى الأعلى باسم «إذن التلفزيون لهذه الإضافة: مسموح»، ومعه «اطلب الإذن من التلفزيون من جديد».
- **هل بطاقة التلفزيون مضافة إلى Apple Home يظهر بجانب اسمها:** «مضاف إلى Apple Home»، أو «غير مضاف إلى Apple Home» ورمزها تحتها. وهي تتبع Apple Home نفسه: البطاقة المحذوفة منه تظهر غير مضافة.

## 1.6.4

Clearer names for the touch area of the remote like Apple TV, and a fuller TV diagnostics file; your settings, pairings and accessories are kept as they are.

- **"Swipe like Apple TV" and "Pointer like a mouse".** The two choices were called Arrows and Pointer, and Arrows read like buttons. Swipe like Apple TV is the touch area you know from Apple's remote: a slide moves the selection, and it works on every TV. Pointer like a mouse moves a pointer on the screen and works on newer TVs only. The icons stay as they were.
- **A TV's diagnostics file lists its options** (tile, remote, touch area, switches); they were missing because the settings were read from the wrong place. No pairing code is included.
- **The note on older TVs says what they do:** Apple TV touch works on them; the pointer does not show on their screen.

**بالعربية**

أسماء أوضح لمساحة اللمس في الريموت الذي مثل Apple TV، وملف تشخيص أكمل للتلفزيون. وإعداداتك واقتراناتك وأجهزتك في Apple Home تبقى كما هي.

- **«سحب مثل Apple TV» و«مؤشر مثل الماوس».** كان اسما الاختيارين «أسهم» و«مؤشر»، و«أسهم» توحي بأزرار. «سحب مثل Apple TV» هو اللمس الذي تعرفه من ريموت Apple: السحب يحرّك التحديد، ويعمل على كل التلفزيونات. و«مؤشر مثل الماوس» يحرّك مؤشرًا على الشاشة، وهو للتلفزيونات الحديثة فقط. والأيقونات كما هي.
- **ملف تشخيص التلفزيون يذكر خياراته** (البطاقة، الريموت، مساحة اللمس، المفاتيح)، وكانت ناقصة لأن الإعدادات كانت تُقرأ من مكان خاطئ. ولا يحتوي رمز الاقتران.
- **تنبيه التلفزيونات القديمة يصف ما تفعله:** لمس Apple TV يعمل عليها، والمؤشر لا يظهر على شاشتها.

## 1.6.3

Fixes to 1.6.2. Your settings, pairings and accessories are kept as they are.

- **The pointer is greyed out on 2016 TVs.** A 2016 model (seen on a real UA55KU7000) lists a touch pad on its info page, made for Samsung's old phone app, yet moves no pointer from a remote, so the choice stayed open. The TV's model year, which its info page gives, now decides first: 2016 models get arrows only, with the note. A pointer chosen before is replaced by arrows.
- **TVs have a diagnostics file.** The Diagnostics button of a TV was greyed out, and the one inside its options said there was no stored reading. It now asks the TV for its info page (the TV must be on) and saves it with what the plugin learned about it; identifiers, addresses and names are removed.
- **The pairing line of a TV already added sits in the "In the Home app" group.** A new TV still pairs first, at the top.
- **Settings: "supported" is written as a word** in place of an untranslated label.

**بالعربية**

إصلاحات على 1.6.2. إعداداتك واقتراناتك وأجهزتك في Apple Home تبقى كما هي.

- **المؤشر يظهر باهتًا في تلفزيونات 2016.** موديل 2016 (رأيناه على تلفزيون حقيقي UA55KU7000) يذكر لوحة لمس في صفحة معلوماته، لأجل تطبيق Samsung القديم للجوال، لكنه لا يحرّك مؤشرًا من الريموت، فبقي الخيار متاحًا. صارت سنة الموديل التي تذكرها صفحة التلفزيون هي التي تحكم أولًا: موديلات 2016 لها الأسهم فقط مع التنبيه، ويُستبدل المؤشر بالأسهم إن كان مختارًا من قبل.
- **صار للتلفزيونات ملف تشخيص.** زر «التشخيص» في بطاقة التلفزيون كان باهتًا، والزر داخل خياراته كان يقول إنه لا توجد قراءة محفوظة. صار يسأل التلفزيون عن صفحة معلوماته (يجب أن يكون مشغَّلًا) ويحفظها مع ما عرفته الإضافة عنه، بعد حذف المعرّفات والعناوين والأسماء.
- **سطر الاقتران للتلفزيون المضاف صار داخل مجموعة «في تطبيق Home».** والتلفزيون الجديد ما زال يقترن أولًا في الأعلى.
- **الإعدادات: «مدعوم» تظهر كلمةً** بدل اسم داخلي غير مترجم.

## 1.6.2

Simpler settings for TVs, and the pointer offered only where the TV supports it; your settings, pairings and accessories are kept as they are.

- **Three ticks in place of four choices.** The TV options are now three ticks that do not exclude one another: the remote like Apple TV, the TV tile with the Home remote, and switches for automations. Tick all of them, some or none; "Both together" and "No remote" are gone, since the ticks say the same.
- **Each setting sits under the option it belongs to.** Under the remote like Apple TV: its pairing code, changed right there, and the touch area (arrows or pointer). Under the TV tile: its code for the Home app. The switches need no code: they come with the plugin's bridge. The tile and the switches are grouped as "In the Home app".
- **The name is edited in the card's head, for every appliance.** A pencil beside the name turns it into a field in place; the separate Rename button and the name field inside the TV options are gone.
- **A choice to make stands out.** The connection engine and the washer's cycle-tile style sit in a yellow box with blue text, so they no longer read as part of the notes around them.
- **Pairing with the TV is one short line** at the top of the options, with "Pair with the TV again" beside it.
- **The pointer only where the TV supports it.** Older Samsung TVs take only arrows from a remote. Each TV's info page says whether it has a touch pad (newer models list it; older ones give no such list). Where it does not, the pointer choice is greyed out with a clear note, and a pointer chosen before is replaced by arrows. Until a TV has answered while on, a note says that older models do not support it.

**بالعربية**

إعدادات أبسط للتلفزيونات، والمؤشر يظهر فقط حيث يدعمه التلفزيون. وإعداداتك واقتراناتك وأجهزتك في Apple Home تبقى كما هي.

- **ثلاث علامات بدل أربعة اختيارات.** صارت خيارات التلفزيون ثلاث علامات لا يمنع أحدها الآخر: الريموت الذي مثل Apple TV، وبطاقة التلفزيون مع ريموت Home، ومفاتيح الأتمتة. تختارها كلها أو بعضها أو لا شيء منها. وحُذف «الاثنان معًا» و«دون ريموت» لأن العلامات تؤدي المعنى نفسه.
- **كل إعداد تحت خياره.** تحت الريموت الذي مثل Apple TV: رمز اقترانه وتعدّله في مكانه، ومساحة اللمس (أسهم أو مؤشر). وتحت بطاقة التلفزيون: رمزها لتطبيق Home. والمفاتيح دون رمز لأنها تأتي مع جسر الإضافة. والبطاقة والمفاتيح مجموعتان تحت «في تطبيق Home».
- **الاسم يُعدّل من رأس البطاقة، في كل الأجهزة.** قلم بجانب الاسم يحوّله إلى خانة في مكانه. وحُذف زر «تغيير الاسم» وخانة الاسم داخل خيارات التلفزيون.
- **الاختيار المطلوب يبرز.** محرك الاتصال وطريقة بطاقة دورة الغسالة صارا في مربع أصفر بكتابة زرقاء، فلا يبدوان جزءًا من الشرح حولهما.
- **الاقتران بالتلفزيون سطر قصير** أعلى الخيارات، وبجانبه «اقتران مع التلفزيون من جديد».
- **المؤشر فقط حيث يدعمه التلفزيون.** تلفزيونات Samsung القديمة تقبل الأسهم فقط من الريموت. وصفحة معلومات كل تلفزيون تقول هل فيه لوحة لمس (الموديلات الحديثة تذكرها، والقديمة ليس فيها هذه القائمة). وحيث لا يدعمه، يظهر خيار المؤشر باهتًا مع تنبيه واضح، ويُستبدل بالأسهم إن كان مختارًا من قبل. وإلى أن يجيب التلفزيون وهو مشغَّل، يذكر تنبيه أن الموديلات القديمة لا تدعمه.

## 1.6.1

Fixes to 1.6.0. Your settings, pairings and accessories are kept as they are.

- **TV: power asked again after a failed press is sent.** The guard that keeps the second tile of a pair from pressing the power key twice counted a wish as done before it was carried out. When the TV refused the first press, asking again at once was skipped and the tile showed the TV on while it stayed off. Now only a wish that was carried out counts, and only for a second asked while it ran or within one second after: a later wish, for example after the TV was switched with its own remote, asks the TV and presses again.
- **An appliance that is not reachable stays "No Response".** For purifiers, fans, dehumidifiers, refrigerators, robot vacuums and the washer, a refresh (after a failed command, or the washer's "finished" timer) put an old value back on the tile and hid that the appliance was gone. While it is not reachable nothing is written over that; a command to it is refused at once, and its state is shown again as soon as it is back. Air conditioners already worked this way.
- **Settings: a pairing code that is not four digits is refused.** A typing slip such as three digits saved as if the field were empty, and the TV went back to 0000. Now nothing is saved and the field says why; an empty field still means 0000.
- **Project page:** the status reads 1.6.1, the fallback reading is every 5 seconds by default (4 at least), and the TV rows are back in the table of supported appliances.

**بالعربية**

إصلاحات على 1.6.0. إعداداتك واقتراناتك وأجهزتك في Apple Home تبقى كما هي.

- **التلفزيون: طلب التشغيل بعد ضغطة فاشلة يُرسل.** الحماية التي تمنع البطاقة الثانية من الزوج من ضغط زر التشغيل مرتين كانت تعدّ الطلب منفَّذًا قبل تنفيذه. فإذا رفض التلفزيون الضغطة الأولى، تُجوهل الطلب المكرر فورًا، وعرضت البطاقة التلفزيون مشغَّلًا وهو مطفأ. صار الطلب يُعدّ منفَّذًا بعد تنفيذه فقط، ولا يُتجاهل إلا طلب ثانٍ جاء أثناء تنفيذه أو خلال ثانية بعده. والطلب اللاحق، مثلًا بعد تشغيل التلفزيون أو إطفائه بريموته، يسأل التلفزيون ويضغط من جديد.
- **الجهاز غير المتصل يبقى «لا يستجيب».** في المنقيات والمراوح ومزيلات الرطوبة والثلاجات والمكانس والغسالة، كان تحديثٌ (بعد أمر فاشل، أو مؤقت «انتهت» في الغسالة) يعيد قيمة قديمة إلى البطاقة ويخفي أن الجهاز منقطع. صار لا يُكتب شيء فوق ذلك ما دام الجهاز منقطعًا، ويُرفض الأمر إليه فورًا، وتعود حالته بمجرد اتصاله. والمكيفات كانت تعمل هكذا من قبل.
- **الإعدادات: رمز الاقتران الذي ليس أربعة أرقام يُرفض.** خطأ كتابة مثل ثلاثة أرقام كان يُحفظ كأن الخانة فارغة، فيرجع الرمز إلى 0000. صار لا يُحفظ شيء، وتوضح الخانة السبب. والخانة الفارغة ما زالت تعني 0000.
- **صفحة المشروع:** الحالة 1.6.1، والقراءة الدورية البديلة كل 5 ثوانٍ افتراضيًا (4 على الأقل)، وصفوف التلفزيونات عادت إلى جدول الأجهزة المدعومة.

## 1.6.0

Everything tried in the 1.5.1 and 1.6.0 beta versions, as one release. Your settings, pairings and accessories are kept as they are.

**Commands and state (air conditioners, and now every appliance)**

- **No reading right after a command, in both engines.** Samsung appliances can undo a command that is read back at once; the next reading now waits about 4 seconds, as SmartThings-Local and LocalThings do. Temperature tapped up or down step by step is sent and kept.
- **A tile shows what you asked until the appliance confirms it.** Temperature, switches (WindFree, Fast and the other comfort modes, Dry, Fan Only, Turbo, Auto, display), fan speed and swing no longer go off, back on and off again. A value is held for up to 10 seconds while the appliance catches up; one it has not applied after 12 seconds is reported in the log.
- **Quick on, off and on again works.** Each new command is decided on the unit's reading plus every command still on its way, so the last wish is the one applied.
- **The same rules for purifiers, fans, dehumidifiers, refrigerators and robot vacuums.** A robot vacuum is sent only the start and dock commands it lists itself.
- **Polling interval: at least 4 seconds, 5 by default.** A lower saved value is raised to 4 and the settings say so.
- **After a restart:** an appliance that refuses the first handshake is asked again at once; appliances starting together take turns, two at a time. The log says why an appliance refused, and an appliance switched off at the wall is noted calmly.

**Washer**

- **A sensor for each stage (wash, rinse, spin) and one for drum clean (trial, on by default).** Each can be removed in the settings. Drum clean has been confirmed on a real washer.
- **The course and the last drum clean** are shown in the settings and the log.
- **Switched off during a cycle is a stop, not a finish:** no "finished" notice. Confirmed on a real washer.
- **Alarm code DC is explained** ("the lid was opened during a cycle"). Confirmed on a real washer.

**Other Samsung appliances (trial)**

- Air purifiers, dehumidifiers, refrigerators, robot vacuums, ovens and the like get an accessory: air quality, filters, temperatures, doors, humidity, battery, power and energy. Controls are marked "trial" in the settings, each with a "Not working?" button that opens a ready report. Ovens, ranges, microwaves and cooktops are shown, never commanded.

**TVs and the remote like Apple TV**

- **No press is dropped without a word.** A press while the TV is shown as off asks the TV first; the log says, per remote session, how many presses reached the TV.
- **Power asked twice at once presses the power key once,** so the TV no longer comes on and goes straight off.
- **"Off" from Apple Home can no longer switch a TV on,** and a TV that was on is not shown as off for one missed answer.
- **The touch area can be a pointer (trial),** and a tap clicks what the pointer shows.

**Settings**

- The device list is grouped by kind; each trial control keeps its name, its "trial" tag and its "Not working?" button on one line; unsaved changes are shown; safe to scroll with a finger.
- Each appliance shows how long a reading takes and whether its push updates arrive.
- Each accessory's main tile is marked, so the Home app puts it in front of the group.

**بالعربية**

كل ما جُرّب في نسخ 1.5.1 و1.6.0 التجريبية، في إصدار واحد. إعداداتك واقتراناتك وأجهزتك في Apple Home تبقى كما هي.

**الأوامر والحالة (المكيفات، والآن كل الأجهزة)**

- **لا تُقرأ الحالة بعد الأمر مباشرة، في المحرّكين.** أجهزة Samsung قد تتراجع عن أمر تُقرأ حالته فورًا، فصارت القراءة التالية تنتظر 4 ثوانٍ تقريبًا كما تفعل SmartThings-Local و LocalThings. ورفع الحرارة أو خفضها خطوة بعد خطوة يُرسل ويثبت.
- **البطاقة تعرض ما طلبته حتى يؤكده الجهاز.** الحرارة والمفاتيح (WindFree و Fast وبقية أوضاع الراحة، والتجفيف، والمروحة فقط، والقصوى، والتلقائي، والشاشة) وسرعة المروحة والتأرجح لم تعد تنطفئ ثم تشتغل ثم تنطفئ. تبقى القيمة حتى 10 ثوانٍ ريثما يلحق الجهاز، وما لم يطبّقه بعد 12 ثانية يُكتب في السجل.
- **التشغيل ثم الإطفاء ثم التشغيل بسرعة يعمل.** كل أمر جديد يُقرَّر على قراءة الجهاز مع كل أمر ما زال في الطريق، فيُطبَّق آخر ما طلبته.
- **القواعد نفسها للمنقيات والمراوح ومزيلات الرطوبة والثلاجات والمكانس.** والمكنسة الروبوت لا يُرسل إليها إلا أمرا البدء والعودة اللذان تعلنهما بنفسها.
- **فترة القراءة: 4 ثوانٍ على الأقل، و5 افتراضيًا.** القيمة المحفوظة الأقل تُرفع إلى 4، وتنبّه الإعدادات إلى ذلك.
- **بعد إعادة التشغيل:** الجهاز الذي يرفض أول مصافحة يُسأل مرة أخرى فورًا، والأجهزة التي تبدأ معًا تتناوب اثنين اثنين. ويذكر السجل سبب رفض الجهاز، ويكتب بهدوء عن الجهاز المطفأ من الكهرباء.

**الغسالة**

- **حساس لكل مرحلة (غسيل، شطف، عصر) وحساس لتنظيف الحوض (تجريبي، مفعّل افتراضيًا).** ويمكن إزالة كل واحد من الإعدادات. وتأكدنا من حساس تنظيف الحوض على غسالة حقيقية.
- **نوع الدورة وآخر تنظيف للحوض** يظهران في الإعدادات والسجل.
- **إطفاؤها أثناء الدورة إيقاف وليس انتهاءً،** فلا يصل إشعار «انتهت». تأكدنا منه على غسالة حقيقية.
- **رمز التنبيه DC مشروح** («فُتح الغطاء أثناء الدورة»). تأكدنا منه على غسالة حقيقية.

**أجهزة Samsung الأخرى (تجريبي)**

- منقيات الهواء ومزيلات الرطوبة والثلاجات والمكانس الآلية والأفران وما شابهها صار لها ملحق: جودة الهواء، الفلاتر، الحرارة، الأبواب، الرطوبة، البطارية، القدرة والطاقة. وظائف التحكم معلَّمة «تجريبي» في الإعدادات، ولكل منها زر «لا تعمل؟» يفتح تقريرًا جاهزًا. والأفران والمواقد والميكروويف تُعرض ولا تُرسَل إليها أوامر.

**التلفزيونات والريموت الذي مثل Apple TV**

- **لا تضيع ضغطة دون أثر.** الضغطة والتلفزيون معروض مطفأً تسأل التلفزيون أولًا، ويذكر السجل في كل جلسة ريموت كم ضغطة وصلت إلى التلفزيون.
- **طلب التشغيل مرتين معًا يضغط الزر مرة واحدة،** فلا يشتغل التلفزيون ثم ينطفئ فورًا.
- **أمر «إطفاء» من Apple Home لم يعد يشغّل التلفزيون،** والتلفزيون المشغَّل لا يُعرض مطفأً لأجل رد واحد فائت.
- **منطقة اللمس يمكن أن تكون مؤشرًا (تجريبي)،** والنقرة تضغط ما يشير إليه المؤشر.

**الإعدادات**

- قائمة الأجهزة مجمّعة حسب النوع، وكل وظيفة تجريبية يبقى اسمها وعلامة «تجريبي» وزر «لا تعمل؟» في سطر واحد، والتغييرات غير المحفوظة ظاهرة، والتمرير بالإصبع آمن.
- كل جهاز يعرض مدة القراءة، وهل تصل تحديثاته الفورية.
- البطاقة الرئيسية لكل ملحق معلَّمة، فيضعها تطبيق Home في واجهة المجموعة.

## 1.6.0-beta.17

Trial version on the "beta" channel. Everything in 1.6.0-beta.16, plus:

- **Every appliance follows the air conditioner's rules for commands.** Purifiers, fans, dehumidifiers, refrigerators and robot vacuums: a value is now held on the tile from the moment it is sent, not only once the appliance acknowledged it, so a reading taken meanwhile no longer puts the old value back; the Home app gets its answer within about a second while a slow appliance is still acknowledging; a value the appliance accepted but did not apply within 10 seconds is reported in the log and its real state shown.
- **Robot vacuum: only a command the robot lists is sent.** As LocalThings does, the start and dock commands are taken from the robot's own list of supported commands; one that lists neither is shown read only. The other appliance commands were checked against LocalThings and match.
- **TV: power asked twice at once presses the power key once.** The Home app sends the same power command through the TV tile and its power switch together; both found the TV off and both pressed the key, which is a toggle, so the TV came on and went straight off. Power commands now run one after another, and the same wish within 5 seconds of the last one is not repeated.
- **Washer: switched off in the middle of a cycle is a stop, not a finish.** A washer switched off from another app during a drum clean reported the end of its cycle, and the "finished" sensor gave a notice. Now a washer that was on during the cycle and is off at its end gives no notice; the log says it was switched off.
- **Washer: the alarm code DC is explained** ("the lid was opened during a cycle"), confirmed on a real washer. Other codes are shown as sent.

**بالعربية**

نسخة تجريبية على قناة «beta». كل ما في 1.6.0-beta.16، ومعه:

- **كل الأجهزة تتبع قواعد المكيف في الأوامر.** المنقيات والمراوح ومزيلات الرطوبة والثلاجات والمكانس: صارت القيمة تبقى على البطاقة من لحظة إرسالها، لا من لحظة تأكيد الجهاز فقط، فلا تعيد قراءةٌ في الأثناء القيمةَ القديمة. ويحصل تطبيق Home على الرد خلال ثانية تقريبًا والجهاز البطيء ما زال يؤكد. والقيمة التي قبلها الجهاز ولم يطبّقها خلال 10 ثوانٍ تُكتب في السجل وتُعرض حالته الحقيقية.
- **المكنسة الروبوت: لا يُرسل إلا أمر تعلنه المكنسة نفسها.** كما تفعل LocalThings، يؤخذ أمرا البدء والعودة للقاعدة من قائمة الأوامر التي تعلنها المكنسة. والتي لا تعلن أيًّا منهما تُعرض للقراءة فقط. وبقية أوامر الأجهزة روجعت على LocalThings وهي مطابقة.
- **التلفزيون: طلب التشغيل مرتين معًا يضغط زر التشغيل مرة واحدة.** تطبيق Home يرسل أمر التشغيل نفسه من بطاقة التلفزيون ومن مفتاح التشغيل معًا. وكان كلاهما يجد التلفزيون مطفأً فيضغط الزر، والزر يبدّل الحالة، فيشتغل التلفزيون ثم ينطفئ فورًا. صارت أوامر التشغيل تُنفَّذ واحدًا بعد الآخر، ولا يُكرَّر الطلب نفسه خلال 5 ثوانٍ من سابقه.
- **الغسالة: إطفاؤها أثناء الدورة إيقاف وليس انتهاءً.** الغسالة التي أُطفئت من تطبيق آخر أثناء تنظيف الحوض أبلغت عن انتهاء دورتها، فأرسل حساس «انتهت» إشعارًا. صارت الغسالة التي كانت مشغّلة أثناء الدورة ومطفأة عند نهايتها لا ترسل إشعارًا، ويذكر السجل أنها أُطفئت.
- **الغسالة: رمز التنبيه DC مشروح** («فُتح الغطاء أثناء الدورة»)، وقد تأكدنا منه على غسالة حقيقية. وبقية الرموز تظهر كما ترسلها الغسالة.

## 1.6.0-beta.16

Trial version on the "beta" channel. Everything in 1.6.0-beta.15, plus:

- **A switch turned on and off again quickly no longer sticks and springs back.** WindFree, Fast and the other comfort modes, Dry, Fan Only, Turbo, Auto and the display: switching one on and then off again before the air conditioner reported the first change left the unit in the first state while the tile showed the second, and after some seconds the tile sprang back. Two causes, both fixed. Turning a mode off was decided on the last reading, which did not show it on yet, so nothing was sent. And a repeated value was compared with the oldest one still awaiting confirmation, so on, off and on again dropped the last "on". New commands are now decided on one picture of the unit: its reading plus every command still on its way or not yet reported back. How commands are sent is unchanged.
- **The main tile is the face of the accessory.** The washer's cycle tile (or its finished sensor, if the cycle tile is off) and each appliance's main tile are marked as such, so the Home app puts them in front when it shows the accessory's tiles as one group.

**بالعربية**

نسخة تجريبية على قناة «beta». كل ما في 1.6.0-beta.15، ومعه:

- **المفتاح الذي يُشغَّل ثم يُطفأ بسرعة لن يعلق ثم يرجع.** WindFree وFast وبقية أوضاع الراحة، والتجفيف، والمروحة فقط، والسرعة القصوى، والتلقائي، والشاشة: تشغيل أحدها ثم إطفاؤه قبل أن يبلغ المكيف عن الأول كان يترك المكيف على الحالة الأولى والبطاقة على الثانية، ثم ترجع البطاقة بعد ثوانٍ. السبب أمران أُصلحا معًا: إطفاء الوضع كان يُقرَّر على آخر قراءة، وهي لم تُظهره مشغّلًا بعد، فلا يُرسل شيء. والقيمة المكررة كانت تُقارن بأقدم قيمة تنتظر التأكيد، فتشغيل ثم إطفاء ثم تشغيل كان يُسقط التشغيل الأخير. صارت الأوامر الجديدة تُقرَّر على صورة واحدة للمكيف: قراءته ومعها كل أمر في الطريق أو لم يُبلَّغ عنه بعد. طريقة إرسال الأوامر لم تتغير.
- **البطاقة الرئيسية واجهة الملحق.** بطاقة الدورة في الغسالة (أو حساس انتهاء الدورة إن أُطفئت بطاقة الدورة) والبطاقة الرئيسية لكل جهاز صارت محددة، فيضعها تطبيق Home في الواجهة حين يعرض بطاقات الملحق مجمّعة.

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
