# Releasing Lezerv on Google Play

How to turn this project into an app people can install from Google Play, and what
to answer in Play Console's forms. Do the steps in order; ☐ marks the ones only you can do.

## 0. Before the first release: blockers

| | Blocker | Why |
|---|---|---|
| ☐ | **Run it on a real phone** (section 3) | The Android-only code has been compiled but never run on a device |
| ☐ | **Legal review** of Terms and Privacy (app: `data/SampleData.kt` `LIVE_*`; website: PR #7) | Play and the NDPA require an accurate privacy policy; the text is a draft |
| ☐ | **Decide payments for launch** | The app has no in-app payment. The live Terms say the price is agreed in chat and "paying in the app is coming soon"; change that wording if you decide otherwise |
| ☐ | **SMS provider** for phone sign-in (Supabase → Authentication → Phone) | Without it only email sign-in works |
| ☐ | **Firebase** (`supabase/PUSH_NOTIFICATIONS.md`) | Artisans miss requests while the app is closed |
| ☐ | **App icon**: send the logo file | The launcher icon is a placeholder |
| ☐ | **Email domain** verified in Resend (`supabase/EMAILS.md` step 5) | Otherwise no emails reach customers |

## 1. What a release build is

`./gradlew bundleRelease` makes an **Android App Bundle** (`.aab`), the file Play wants.
Compared with the builds you run from Android Studio:

- **Demo mode is off**: no role switch, Reset, "skip ahead" or "Demo: fill" helpers.
- **It's signed with your upload key**, Play's proof that an update really comes from you.
- **It talks to the backend in `local.properties`**: always build releases with it set.
  Without it the app falls back to sample data.

## 2. ☐ Create the upload key (once, ever)

The upload key is a file plus a password. **If you lose it you can't update the app**
until Google support resets it, which takes days. Keep two copies off this computer,
for example in a password manager and on a USB stick, and never put it in git.

```sh
keytool -genkeypair -v -keystore lezerv-upload.jks -alias lezerv-upload \
  -keyalg RSA -keysize 2048 -validity 10000
```

`keytool` comes with Android Studio's Java, under `Android Studio/jbr/bin`. Or, in
Android Studio: **Build → Generate Signed App Bundle → Create new…**

Then add four lines to `android/local.properties`, which is never committed:

```
release.storeFile=/full/path/to/lezerv-upload.jks
release.storePassword=…
release.keyAlias=lezerv-upload
release.keyPassword=…
```

(With today's Java, the key password must be the same as the store password; keytool
asks for only one.)

On Play Console, keep **Play App Signing** on (the default). Google then holds the key
that signs what people download, and your upload key only proves uploads are yours.

## 3. ☐ Test the release build on your phone

```sh
cd android
./gradlew assembleRelease     # a signed .apk you can install directly
adb install app/build/outputs/apk/release/app-release.apk
```

(Or copy the `.apk` to the phone and open it.) Then walk through this:

- [ ] The map loads around you after **Use my location**, with real streets
- [ ] Sign in (email, or phone if SMS is set up)
- [ ] Save an address with **I'm here**, and book an available artisan
- [ ] On a second phone as an artisan: go online, share location, accept, start with the code, complete
- [ ] Chat both ways, and get notifications with the app closed (needs Firebase)
- [ ] **Account → Settings → Delete account** sends the request
- [ ] No "Demo" rows anywhere

## 4. Build the bundle

```sh
./gradlew bundleRelease
# → app/build/outputs/bundle/release/app-release.aab
```

**Every upload needs a higher `versionCode`** in `app/build.gradle.kts`: 10, then 11, 12…
`versionName` (1.0.0, 1.0.1…) is what people see.

## 5. ☐ Play Console

1. **Developer account** ($25 once) at play.google.com/console.
   - Register as an **organization (Lezerv Limited)** if you can. It needs a D-U-N-S
     number, which is free.
   - A **personal** account must run a closed test with **at least 12 testers for 14
     days** before the app can go public.
2. **Create app**: name *Lezerv*, default language English (UK), App (not game), Free.
3. **Testing → Internal testing**: upload the `.aab` and add your own Gmail as tester.
   Install it from the Play link, the same way users will.
4. Fill in **App content** (answers below) and **Store listing**.
5. **Closed testing** (the 12 testers, if required), then **Production**. The first
   review usually takes a few days.

### App content answers

| Form | Answer |
|---|---|
| Privacy policy | `https://www.lezerv.com/privacy` |
| App access | Some features need sign-in. Give reviewers a test account: an email + password that works on lezerv.com, and say they can browse the map without signing in |
| Ads | No ads |
| Content rating | Questionnaire: no violence, sex, drugs or gambling. **Users can interact** (chat): yes. **Shares location**: yes. **Digital purchases**: no |
| Target audience | 18 and over |
| News app | No |
| Data safety | See below |
| Government app / Financial features / Health | No / None / No |
| Account deletion | In the app: Account → Settings → Delete account. Web: `https://www.lezerv.com/delete-account` (after PR #7 is merged) |

### Data safety

Data shared with service providers that process it **for** Lezerv (Supabase, Firebase,
Resend) does not count as "shared" in Play's terms.

| Data type | Collected | Shared | Optional? | Why |
|---|---|---|---|---|
| Location: approximate and precise | Yes | No | Optional (the app works without it) | App functionality: nearby artisans; artisans' position while online |
| Name | Yes | No | Required | Account management, App functionality |
| Email address | Yes | No | Optional (phone sign-in works without it) | Account management, communications |
| Phone number | Yes | No | Optional (email sign-in works without it) | Account management |
| Address | Yes | No | Required to book | App functionality |
| Other in-app messages (chat, support) | Yes | No | Optional | App functionality, support |
| Device or other IDs (notification token) | Yes | No | Optional | App functionality: notifications |

- **Encrypted in transit:** yes.
- **Users can ask for deletion:** yes.
- **Not collected by the app:** photos, financial or payment info, contacts, health,
  web history, app activity or analytics. Artisans upload ID documents on the website,
  not in the app.

If you add analytics, crash reporting, payments or photo upload later, update these answers.

### Store listing (draft)

**Short description** (80 characters max):
> Book trusted, ID-verified artisans near you in Lagos: plumbing, power, cleaning and more.

**Full description:**
> Need a plumber, electrician, AC technician, cleaner or cook? Lezerv shows verified
> artisans near you on a live map. Pick one, send your request, and they have seconds to
> accept, or we offer your job to others nearby.
>
> • Every artisan's ID and address are checked before they can work
> • See who's available near you right now, with ratings and reviews
> • Agree the price in chat before work starts
> • A start code means only the artisan you booked can begin the job
> • Your phone number stays private: chat hides contact details
> • Save home and work addresses, pinned to your gate
>
> Artisans: go online, get requests from clients nearby, and navigate straight to the job.
>
> Lezerv works in Lagos today, with more cities to come.

**Graphics:**
- App icon, 512 × 512 PNG
- Feature graphic, 1024 × 500
- 2–8 phone screenshots, taken from the release build on a real phone

## 6. Every later release

1. Raise `versionCode` (and `versionName`).
2. `./gradlew bundleRelease`
3. Play Console → the track → **Create new release** → upload → release notes → roll out.
