// What's New: the changes admins see on /admin/whats-new, newest first.
//
// Add an entry with every update that admins or customers would notice: a new
// page or button, a changed rule, new prices or photos. Write it for the
// admins, not developers: what changed and where to find it. Keep a fleet's
// private details (income, expenses, credit) out: every fleet's admins see
// this page. `link` opens the page it is about.
//
// kind: 'new' (a new page or feature), 'improved', 'fixed', 'rule' (how
// something works now), 'data' (prices, fleets, cars, photos).
//
// A long entry can add `details: [{ heading, items: [text], numbered }]` (a
// text may hold line breaks), folded under `detailsLabel` until opened; its
// `link` then shows inside, labelled `linkLabel`.

export const CHANGELOG = [
  {
    date: '2026-11-19',
    items: [
      {
        kind: 'data',
        title: 'November rentals from the new RENTAL group (BuBat Resources)',
        text: 'KkWana now posts rentals from November 2026 in a new Telegram group, “RENTAL”, and it is checked along with the Van Sewa group. Its first posts are on rent2go: the Vellfire VJC 5290 rental of 9–13 Nov and the Veloz VQB 5567 rental of 7–8 Nov, each with its payment slips, and the Alza PRE 4166’s 16 Nov service with the workshop invoice and slip, in Expenses as a claim still to pay. The posts don’t give the renters’ names, so those bookings say “name not recorded” until the names are added.',
        link: '/admin/expenses',
      },
      {
        kind: 'new',
        title: 'Customers can WhatsApp you after sending their documents',
        text: 'On “Verification Pending” (new customers) and “Update Under Review” (a new licence, GDL or IC), a green “WhatsApp us to verify faster” button opens WhatsApp to 019-496 1568 with a message giving their name, phone and email. Find them in Customers (Customers to Verify) and verify them.',
        link: '/admin/customers?verification=pending',
      },
      {
        kind: 'data',
        title: 'Bocah Trading: 7 more vehicles',
        text: 'Added from Bocah Trading’s Drive, with photos and their road tax, insurance and Puspakom in Car Documents. Open for booking: Perodua Bezza 1.0 G 2025 (RBC 9682, RM120/day, RM672 for 7 days, RM1,800 for 30 days) and Nissan NV200 2014 (WA 3301 U, RM180/day, RM945 for 7 days, RM2,484 for 30 days). Hidden until their documents are renewed and recorded: Gran Max VNH 3681 (2023, automatic) and WXM 2302, NV200 WXN 5736, BPA 3919 and WYX 6643. Their road tax had run out (and some insurance or Puspakom); Car Documents lists what each needs. Customers WhatsApp Bocah Trading’s fleet number about them.',
        link: '/admin/car-documents',
      },
    ],
  },
  {
    date: '2026-11-18',
    items: [
      {
        kind: 'data',
        title: 'New weekly and monthly prices for every vehicle',
        text: 'Long rentals are cheaper, close to what renters pay elsewhere in the Klang Valley, so more vehicles can go out by the month. Alza RM180/day, RM1,008 for 7 days, RM2,700 for 30 days. Veloz RM200/day, RM1,120 for 7 days, RM3,300 for 30 days. Vellfire RM400/day, RM2,240 for 7 days, RM6,000 for 30 days. Ranger RM380/day, RM2,128 for 7 days, RM5,700 for 30 days. Panel vans (NV200 VEY 3516, Gran Max VEY 3830) RM180/day (was RM220), RM945 for 7 days, RM2,484 for 30 days; the vans not open for booking have the same rates for when they return. Bookings already made keep their price.',
        link: '/admin/cars',
      },
    ],
  },
  {
    date: '2026-11-17',
    items: [
      {
        kind: 'improved',
        title: 'Rental terms: swipe between parts',
        text: 'Asked by Bocah Trading. On rent2go.my/terms and in the agreement renters sign, each part (A to G) is now a slide: swipe left or right, tap a letter at the top, or use Next at the bottom of a part. A part opens at its top. Printing a signed agreement still prints every part, one after another.',
        link: '/terms',
      },
      {
        kind: 'improved',
        title: 'Rental terms neater: bold key points, shorter sentences',
        text: 'Asked by Bocah Trading. On rent2go.my/terms and in the agreement renters sign, each part (A to G) has a letter badge, each clause a number badge and a bold title, and the amounts and time limits (25%, 3 days, 24 hours, RM30, late fees) are in bold. Long sentences are shorter. The rules, amounts and clause numbers haven’t changed.',
        link: '/terms',
      },
      {
        kind: 'improved',
        title: 'Customer’s bank account on the booking page',
        text: 'Under Customer, a booking now shows the customer’s bank, account number (with a Copy button) and account holder, so you can refund a deposit without looking them up. Open in Customers takes you straight to that customer, already opened, for their credit, documents and Deduct Credit. A counter booking without an account says to refund by hand; a customer without bank details says to add them in Customers.',
        link: '/admin/bookings',
      },
      {
        kind: 'rule',
        title: 'Bocah Trading: perubahan terma sewaan (Google Form → Terma Rent2Go Versi 3)',
        text: 'Mulai 17 Nov 2026, semua sewaan melalui Rent2Go (Bocah Trading dan Bubat Resources) menggunakan satu set terma yang sama, dan penyewa menandatangani perjanjian di Rent2Go (dalam talian atau di kaunter), bukan lagi melalui Google Form. Kontrak yang sudah ditandatangani sebelum 17 Nov 2026 kekal dengan terma asalnya. Terma dalam Bahasa Melayu dan Bahasa Inggeris; jika berbeza, versi Bahasa Melayu terpakai. "Syarikat" ialah pemilik kenderaan dalam invois Rent2Go; invois Bocah Trading kini menunjukkan No. SSM 202003204563 (003146703-M) dan alamat Batu Caves. Nombor klausa di bawah merujuk kepada rent2go.my/terms.',
        detailsLabel: 'Lihat perbezaan penuh daripada terma asal Bocah Trading',
        link: '/terms',
        linkLabel: 'Buka terma penuh (rent2go.my/terms)',
        details: [
          {
            heading: 'A. Yang berubah (berbeza daripada terma asal Bocah Trading)',
            numbered: true,
            items: [
              'Bayaran tempahan dan pembatalan (klausa 1 dan 4)\nDulu: Bayaran tempahan RM100, tidak dikembalikan jika batal kurang 3 hari sebelum tarikh sewa. Deposit keselamatan dibayar berasingan sebelum kunci diserahkan.\nSekarang: Tiada bayaran tempahan berasingan. Deposit dibayar semasa tempahan (atau selewat-lewatnya sebelum kunci diserahkan); ia mengesahkan tempahan dan dipegang sebagai deposit keselamatan. Batal 3 hari atau lebih sebelum tarikh ambil: deposit dikembalikan penuh (atau disimpan sebagai kredit). Batal kurang 3 hari sebelum: penalti 25% daripada jumlah sewa, ditolak daripada deposit.',
              'Tukar tarikh (klausa 3)\nDulu: Boleh tukar ke tarikh dalam tempoh 1 bulan dengan notis 3 hari; jika tarikh baharu tidak ditetapkan, RM100 luput.\nSekarang: Sama (notis 3 hari, ke tarikh dalam tempoh 1 bulan, tanpa caj). Jika tarikh baharu tidak ditetapkan dalam tempoh itu, dikira batal kurang 3 hari (penalti 25%).',
              'Pemulangan deposit (klausa 7)\nDulu: Dalam 3 hingga 7 hari bekerja selepas tamat sewa.\nSekarang: Dalam 7 hari bekerja, atau disimpan sebagai kredit jika penyewa mahu. Boleh ditahan sehingga kos kerosakan diketahui atau tuntutan insurans selesai.',
              'Caj lewat pulang (klausa 17)\nDulu: RM20 sejam untuk semua kenderaan.\nSekarang: Ikut saiz enjin: RM10 sejam (bawah 1300cc), RM15 sejam (1300cc hingga 1699cc, contoh Gran Max 1.5), RM20 sejam (1700cc ke atas). Lewat lebih 5 jam dikira sewa sehari penuh.\nBaharu: jika kenderaan tidak dipulangkan dan penyewa tidak dapat dihubungi lebih 24 jam selepas masa pemulangan, syarikat boleh mengambil semula kenderaan dan membuat laporan polis.',
              'Tanggungan kerosakan (klausa 23 hingga 25)\nDulu: Penyewa tanggung semua kos jika kemalangan berpunca daripada kecuaian. Sewa bulanan: RM500 lebihan / kos tuntutan insurans. Kehilangan atau total loss akibat kecuaian: baki pampasan insurans, kos pentadbiran, tunda dan kerugian pendapatan.\nSekarang: Penyewa membayar kos sebenar (pembaikan yang tidak dibayar insurans, lebihan insurans dan kos tuntutan, NCD yang hilang, sewa yang hilang semasa kenderaan di bengkel), sehingga had maksimum dalam jadual mengikut cc. Contoh Gran Max (1300cc hingga 1499cc): maksimum RM3,500 (bengkel 1 hingga 7 hari), RM4,500 (bengkel lebih 7 hari), RM1,000 (kerosakan kecil).\nKecurian atau hapus kira: amaun "Bengkel lebih 7 hari", dengan syarat laporan polis dibuat dalam 24 jam dan semua kunci dipulangkan.\nTiada had (kos penuh, termasuk tunda, kos pentadbiran dan sewa yang hilang) jika: pemandu tidak diluluskan atau tiada lesen atau GDL yang sah; pemandu di bawah pengaruh alkohol atau dadah; pemanduan berbahaya atau kesalahan jalan raya yang serius; penggunaan yang dilarang, atau keluar dari Semenanjung tanpa kebenaran; kunci ditinggalkan dalam kenderaan atau kenderaan tidak dikunci; laporan polis tidak dibuat dalam 24 jam; atau insurans menolak tuntutan kerana kesalahan penyewa.\nCaj tetap RM500 dibuang; diganti dengan lebihan dan kos tuntutan sebenar.',
              'Tamat awal sewa bulanan (klausa 6)\nDulu: Seluruh deposit keselamatan dilucutkan.\nSekarang: Penalti 25% daripada sewa bagi hari yang tidak digunakan; baki sewa hari tersebut dikembalikan (atau disimpan sebagai kredit). Peraturan yang sama untuk semua sewaan.',
              'Penamatan kerana pelanggaran terma (klausa 27)\nDulu: Syarikat menamatkan perjanjian serta-merta; semua bayaran pendahuluan atau deposit dilucutkan.\nSekarang: Syarikat boleh menamatkan perjanjian serta-merta dan mengambil semula kenderaan (contoh: menyewakan semula kenderaan, penggunaan yang dilarang, pemandu tidak diluluskan, sewa bulanan lewat lebih 7 hari). Penyewa membayar sewa sehingga tarikh itu, caj dan kerosakan, serta penalti 25% daripada sewa hari yang tidak digunakan; jumlah ini boleh ditolak daripada deposit dan sewa yang telah dibayar.',
              'Kerosakan kenderaan sendiri (klausa 21)\nDulu: Kenderaan gantian dalam 24 jam; jika tiada, kontrak dilanjutkan secara automatik tanpa caj.\nSekarang: Kenderaan gantian yang setara dalam 24 jam jika ada. Jika tiada, penyewa memilih: sewa hari yang terjejas dikembalikan, atau sewa dilanjutkan tanpa caj. Jangan baiki sendiri tanpa kebenaran syarikat; kos yang diluluskan dibayar balik dengan resit.',
              'Pemeriksaan semasa serahan (klausa 14)\nDulu: Penyewa "disarankan" mengambil gambar kenderaan.\nSekarang: Periksa bersama syarikat dan rekod (gambar atau video) kerosakan sedia ada, paras minyak dan bacaan odometer. Kerosakan baharu yang tidak direkod semasa serahan dianggap berlaku dalam tempoh sewa. Pemeriksaan bersama semasa pemulangan dikekalkan.',
              'Kawasan pemanduan (klausa 13)\nDulu: Semenanjung Malaysia sahaja.\nSekarang: Semenanjung Malaysia sahaja, tetapi Singapura, Thailand, Sabah atau Sarawak dibenarkan dengan kebenaran bertulis syarikat.',
              'Tandatangan dan keseluruhan perjanjian (klausa 30)\nDulu: Hantar Google Form / tanda kotak persetujuan; borang itu ialah keseluruhan perjanjian.\nSekarang: Tandatangan dan kotak persetujuan di Rent2Go (dalam talian atau di kaunter), sah di bawah Akta Perdagangan Elektronik 2006. Perjanjian ini, bersama tempahan dan invois Rent2Go, ialah keseluruhan perjanjian dan menggantikan borang sewa terdahulu bagi sewaan tersebut.',
              'Perubahan perjanjian (klausa 29)\nDulu: Mesti bertulis dan ditandatangani oleh kedua-dua pihak.\nSekarang: Mesti bertulis, termasuk perubahan tarikh, harga atau kenderaan yang direkod di Rent2Go atau dipersetujui melalui WhatsApp atau e-mel.',
            ],
          },
          {
            heading: 'B. Yang ditambah (tiada dalam terma asal)',
            items: [
              'Sewa bulanan dibayar terlebih dahulu setiap bulan pada tarikh yang dipersetujui (klausa 2).',
              'Jika syarikat membatalkan tempahan: semua bayaran dikembalikan penuh, atau kenderaan lain disediakan jika penyewa bersetuju (klausa 8).',
              'Penyewa bertanggungjawab atas setiap pemandu (klausa 11).',
              'Larangan yang disebut dengan jelas: pengedaran dadah, perlumbaan, perjudian, menarik kenderaan lain, dan e-hailing penumpang (Grab dan sebagainya) tanpa kebenaran bertulis. Penghantaran barang dengan van panel (cth. Lalamove) dibenarkan dengan GDL yang sah (klausa 12).',
              "Saman dan kompaun yang diterima selepas kenderaan dipulangkan atau deposit dikembalikan tetap ditanggung penyewa. Syarikat boleh memberi butiran penyewa kepada PDRM, JPJ, pihak berkuasa tempatan atau syarikat tol untuk memindahkan saman. Tol daripada kad Touch 'n Go / RFID kenderaan termasuk (klausa 16).",
              'GPS: kenderaan mungkin dipasang GPS; lokasi boleh dipantau untuk keselamatan, mendapatkan semula kenderaan dan menyiasat kemalangan atau saman (klausa 18).',
              'Sewa panjang: bawa kenderaan untuk servis apabila diminta (klausa 19).',
              'Lampu amaran: berhenti dengan selamat dan hubungi syarikat; kerosakan akibat terus memandu ditanggung penyewa (klausa 20).',
              'Selepas kemalangan: ambil gambar kenderaan, tempat kejadian dan butiran pihak lain; jangan baiki atau tunda kenderaan tanpa kebenaran syarikat (klausa 26).',
              'Salinan dokumen kenderaan juga boleh dilihat di My Bookings di Rent2Go (klausa 9).',
              'Terma dalam dua bahasa (BM dan BI); versi BM terpakai.',
            ],
          },
          {
            heading: 'C. Yang dikekalkan daripada terma Bocah Trading',
            items: [
              'Sewa penuh dibayar selewat-lewatnya semasa mengambil kenderaan.',
              'Lanjutan sewa dimaklumkan sekurang-kurangnya 24 jam sebelum tamat sewa, tertakluk kepada kekosongan.',
              'Caj pembersihan RM30 (kini juga untuk kenderaan Bubat Resources).',
              'Pulangkan kenderaan dengan paras minyak yang sama.',
              'Syarikat memastikan cukai jalan, insurans dan Puspakom sah; kenderaan diserahkan bersih, selamat dan berfungsi.',
              'Dokumen asal: MyKad atau pasport, lesen Kelas D, GDL Kelas D; sewaan atas nama syarikat: dokumen SSM dan surat lantikan pemandu. Dokumen disimpan sulit (kini mengikut Dasar Privasi Rent2Go).',
              'Hanya pemandu yang diluluskan; tukar atau tambah pemandu dengan kelulusan dahulu. Kenderaan tidak boleh disewakan semula, dipinjamkan atau diserahkan kepada orang lain.',
              'Patuhi Akta Pengangkutan Jalan 1987, had laju dan had muatan; dilarang memandu di bawah pengaruh alkohol atau dadah, membawa barang berbahaya, mudah terbakar atau beracun, dan muatan berlebihan.',
              'Penyewa menanggung minyak, tol, parking, saman dan kompaun.',
              'Syarikat menanggung servis berkala dan kerosakan akibat haus dan lusuh; servis dan pembaikan di bengkel syarikat atau dengan kelulusan syarikat.',
              'Pemeriksaan berkala oleh penyewa: air dan kipas radiator, minyak enjin, tekanan dan keadaan tayar.',
              'Kemalangan: maklumkan dalam 12 jam, laporan polis dalam 24 jam, jangan mengaku salah atau berunding dengan pihak ketiga.',
              'Deposit boleh ditahan sementara tuntutan insurans belum selesai.',
              'Jika syarikat bersalah (kenderaan tidak layak jalan, dokumen tidak sah, atau mengambil balik kenderaan tanpa kesalahan penyewa): deposit dan baki sewa dikembalikan penuh tanpa potongan.',
              'Pertikaian: rundingan dalam 14 hari, kemudian pengantara (mediator); undang-undang Malaysia (Akta Kontrak 1950, Akta Pengangkutan Jalan 1987); terma lain kekal jika satu terma tidak sah.',
            ],
          },
          {
            heading: 'D. Yang dibuang',
            items: [
              'Bayaran tempahan RM100 yang tidak dikembalikan (diganti dengan peraturan deposit, A1).',
              'Caj tetap RM500 untuk tuntutan insurans sewa bulanan (diganti dengan kos sebenar, A5).',
              'Lucut seluruh deposit jika sewa bulanan ditamatkan awal (diganti dengan penalti 25% hari yang tidak digunakan, A6).',
              'Lucut semua bayaran jika melanggar terma (diganti dengan bayar jumlah terhutang dan penalti 25%, A7).',
            ],
          },
        ],
      },
      {
        kind: 'improved',
        title: 'Rental terms easier to read: one language at a time',
        text: 'The terms page and the agreement no longer mix Malay and English sentence by sentence. A Bahasa Melayu / English switch at the top shows one language at a time (Malay first). Each clause has a short title, and lists such as the steps after an accident, the documents to bring and the late-return rates are on separate lines. The wording and the rules are unchanged.',
        link: '/terms',
      },
      {
        kind: 'rule',
        title: 'One set of rental terms for every fleet (version 3)',
        text: 'BuBat Resources and Bocah Trading now use the same Terma & Syarat, merged from both companies’ terms, for every rental signed from 17 Nov 2026. New: moving dates is free with 3 days’ notice (to dates within 1 month); cancelling 3 days or more before pick-up gets the deposit back in full, later costs 25% of the rental; extensions are asked 24 hours ahead; cleaning is RM30; a similar replacement within 24 hours for a breakdown (or the days free); renters check coolant, oil and tyres; drivers changed only with approval; company rentals show their SSM and a driver letter; no dangerous goods; tell the company within 12 hours of an accident; dangerous driving pays the full cost; you may end the rental at once for a serious breach; disputes go to discussion within 14 days, then mediation; signing on Rent2Go counts as signing on paper. Late return stays by engine size, and ending early (monthly too) stays 25% of the unused days. Bocah Trading invoices now show its own SSM number and address. Earlier signed agreements keep their own terms.',
        link: '/terms',
      },
    ],
  },
  {
    date: '2026-11-16',
    items: [
      {
        kind: 'data',
        title: 'NV200 WA 5202 F off the booking page for repair',
        text: 'WA 5202 F needs its gear lever repaired, maybe the gearbox, so it is marked unavailable and customers can’t book it. It had no bookings. Make it available again in Cars once it is fixed. The other NV200, VEY 3516, can still be booked.',
        link: '/admin/cars',
      },
      {
        kind: 'fixed',
        title: 'SSM number on the terms page, and only on BuBat Resources invoices',
        text: 'The terms page and Privacy Policy now show Bubat Resources’ SSM registration number. Invoices showed Bubat Resources’ SSM number and address for every fleet; Bocah Trading’s invoices now show only its own name and phone number.',
        link: '/terms',
      },
      {
        kind: 'rule',
        title: 'Rental terms version 2: clearer, in Malay and English',
        text: 'New agreements are signed with version 2 of the Terma & Syarat. Same licence, GDL, cleaning and damage table, but clearer: the damage table is the most a renter pays per incident (full cost for an unapproved driver, drink or drugs, keys left in the car, no police report and similar), theft or a write-off costs the “more than 7 days” amount, late return is RM10/RM15/RM20 an hour by engine size with more than 5 hours counting as a full day, and the 25% penalty for ending early is on the unused days only (End early works it out). New clauses: approved drivers only, Lalamove allowed in vans with a GDL but no passenger e-hailing, Peninsular Malaysia only, photos at pick-up, same fuel level, tolls and late summonses, GPS, accident steps, breakdowns for every rental, monthly rent paid in advance, and a full refund if you cancel. Agreements signed before 16 Nov 2026 keep showing version 1, the terms the renter signed.',
        link: '/terms',
      },
      {
        kind: 'new',
        title: 'Rental terms page anyone can open: rent2go.my/terms',
        text: 'Customers can read the Terma & Syarat before signing up: the same terms, damage table, deposit refund and cancellation penalty as the rental agreement they sign. Send the link when someone asks for the terms. It is in the footer and under the Book button on every car page, and shows a proper title when shared on WhatsApp.',
        link: '/terms',
      },
    ],
  },
  {
    date: '2026-11-15',
    items: [
      {
        kind: 'data',
        title: 'Vellfire VJC 5290 listed as 8 seater',
        text: 'The Vellfire’s car page said 7 seats. It has a middle-row bench and seats 8, as its Japan auction report shows, so it now says 8 seats and “8 seater MPV”.',
        link: '/admin/cars',
      },
      {
        kind: 'data',
        title: 'Test rental on the Ranger removed',
        text: 'The 8–12 Nov booking on the Ford Ranger VDM 6927 was a test, so it was deleted with its payments, agreement, extension and receipts. It no longer shows in Bookings, Sales or the car’s history, and no deposit credit was given for it. The Ranger’s road tax and insurance records are real and stay.',
        link: '/admin/bookings',
      },
    ],
  },
  {
    date: '2026-11-12',
    items: [
      {
        kind: 'fixed',
        title: 'Extension receipts are added, not swapped',
        text: 'After an extension, the new rent receipt used to take the place of the first one under Payment Receipts → Full Payment, so only the latest could be opened there. Both were always kept with their payments. Now Full Payment lists every rent receipt (Receipt 1, Receipt 2…) with its amount and date, and a new one waiting to be checked says so. Customers see each one in My Bookings too (Payment Receipt 1, 2…).',
        link: '/admin/bookings',
      },
      {
        kind: 'new',
        title: 'Car page calendar greys out booked days',
        text: 'Customers now pick the pick-up and return days on a calendar on the car page, with the days the car is booked greyed out and struck through, so they can see which dates are free instead of guessing. Return days stop before the next booking. Opening a link with dates that clash shows the calendar straight away. Only the dates show, not who booked. The home page search keeps its date boxes.',
        link: '/',
      },
      {
        kind: 'fixed',
        title: 'The invoice gives the car’s WhatsApp number',
        text: 'The phone number on the invoice (at the top and in “Untuk sebarang pertanyaan, sila hubungi …”) is now the car’s WhatsApp contact from Cars → Edit, the same number its WhatsApp button opens. It used to print the fleet’s Support Phone, which was a different number. The customer’s Print Receipt gives the same number.',
        link: '/admin/cars',
      },
      {
        kind: 'data',
        title: 'Vans show their size: 7ft panel van',
        text: 'The NV200 and Gran Max vans now list “7ft panel van” first under Features on their car page, instead of “Panel van”, so customers see the van size. The Vanette WQT 6612 still says “Panel van”.',
        link: '/admin/cars',
      },
      {
        kind: 'improved',
        title: 'Car list shows each vehicle’s type',
        text: 'Each car in the list on the home page now has its type on the photo, top left: “7ft panel van”, “7 seater MPV”, “Pick-up”. It is the car’s first feature in Cars → Edit.',
        link: '/',
      },
    ],
  },
  {
    date: '2026-11-11',
    items: [
      {
        kind: 'new',
        title: 'Customers see the car’s road tax, insurance and Puspakom while renting',
        text: 'In My Bookings, a customer who has the car now (Picked Up, or Confirmed from the pick-up day to the return day) sees Car documents: the road tax, insurance and Puspakom recorded in Car Documents, with the date each is valid until and the files to open, e.g. at a roadblock. Only the one of each type that counts today; not GPS, the cost or older renewals. After the return they are gone. The files are shown as uploaded, so check what is on them.',
        link: '/admin/car-documents',
      },
    ],
  },
  {
    date: '2026-11-10',
    items: [
      {
        kind: 'data',
        title: 'New cab photos: VEY 3830',
        text: 'The Gran Max VEY 3830’s cab photos are new, taken on 10 Nov: the dashboard, and both front seats with their new red and black seat covers. They replace the older cab photos without covers. The outside and cargo photos and the main picture are unchanged.',
        link: '/cars/3628277a-a0d1-4304-a051-b1fc47d47b58',
      },
      {
        kind: 'improved',
        title: 'Links sent on WhatsApp show what they are for',
        text: 'A rent2go.my link sent on WhatsApp (or Facebook, Telegram) now has its own title and picture instead of the same Rent2Go banner every time. A car link shows the car, its photo, plate and price a day; with dates picked, the dates and number of days too. The agreement link reads "Rental agreement · Booking" and the booking number, and invoice, documents, sign-in and admin links each say which page they open. WhatsApp keeps the preview of a link it has seen before, so a link sent earlier may still show the old one.',
        link: '/admin/manual',
      },
      {
        kind: 'new',
        title: 'Counter: deposit paid at pick-up',
        text: 'A booking can now be saved before the deposit is paid. Under Deposit paid, choose At pick-up (or Not paid yet for a rental already out). The car shows "Deposit not paid" and the Deposits to collect chip lists it until you open the rental and press Deposit received, with cash or transfer, the date and the deposit receipt. A deposit received when you save has its own receipt upload too, separate from the chat screenshots.',
        link: '/admin/counter',
      },
      {
        kind: 'data',
        title: 'Lower daily rate: WA 5202 F',
        text: 'The NV200 panel van WA 5202 F is now RM180 a day (was RM220). The other panel vans stay at RM220. Its long-rental discounts are unchanged (the fleet’s 10% for 7 days or more, 40% for 30 days or more). Bookings already made keep their price.',
        link: '/cars/6aa2c9fe-3b69-4239-82b7-90f4e7e43c22',
      },
    ],
  },
  {
    date: '2026-11-09',
    items: [
      {
        kind: 'data',
        title: 'New photos: Vellfire VJC 5290',
        text: 'The Vellfire’s gallery has 12 new photos taken on 8 Nov 2026: the outside from all four corners, the dashboard and driver’s seat, the cabin from the front and from the boot (seats folded), and the 2nd and 3rd rows. Plates are blurred. The daytime front photo stays the main one.',
        link: '/cars/42f4148d-4f92-49a5-ba17-282492e74538',
      },
    ],
  },
  {
    date: '2026-11-08',
    items: [
      {
        kind: 'data',
        title: 'Expenses checked against the bank: office rent and a gearbox bill added',
        text: 'BuBat Resources’ expenses from January 2025 were checked against its bank statements, transfer by transfer. Two costs paid from the account were missing and are now in Expenses: the monthly office rent (no car; January 2025 to July 2026) and the second-hand gearboxes fitted to WWE 6724 and WA 5099 Q in July 2025 (half on each van). Both count in Sales.',
        link: '/admin/expenses',
      },
      {
        kind: 'data',
        title: 'WWE 6724’s 2025–2026 history recorded',
        text: 'The Gran Max WWE 6724 (in the workshop since September 2025) now has its rentals and expenses on rent2go from January 2025: the monthly rentals with every payment, the short rentals, and each repair, Puspakom and road tax with its receipt and payment slip. Its June 2025 exchange to WA 5099 Q is on the booking. W 9490 C also got a summons record from February 2025 that was only in the workbook.',
        link: '/admin/sales',
      },
      {
        kind: 'data',
        title: 'Sold vans’ 2025–2026 history recorded',
        text: 'The four Gran Max vans sold since 2025 (WVW 3146, WA 5099 Q, WA 7085 K and WWX 9326) now have their rentals and expenses on rent2go, from January 2025 to the month each was sold: every rental with its customer, dates and payments (and deposits and refunds), and every repair, service, road tax and carwash with its receipt and payment slip. Van exchanges and shared rentals are split between the vans. Open a van in Cars → History, or see them in Bookings, Expenses and Sales (This Year / Last Year).',
        link: '/admin/sales',
      },
      {
        kind: 'new',
        title: 'Salaries count as fleet expenses',
        text: 'Staff and partner pay is now a fleet expense. In Expenses, Submit Claim has a new choice, Salary (staff & partners), next to Others (General), and the car filter has Salaries. On Sales, salaries have their own row under Revenue and Expenses Per Car, Expenses Paid shows how much of it is salaries, and Profit counts them. Past partner pay from January 2025 has been added for the fleet that pays one: one claim per month, dated the last day of the month worked. Months not settled yet are Pending.',
        link: '/admin/sales',
      },
      {
        kind: 'fixed',
        title: 'Fleet selector list no longer see-through',
        text: 'Opening the fleet selector at the top of the admin sidebar (BuBat Resources / Bocah Trading) showed the menu items underneath through its list, so on phones the fleet names ran into Counter and Dashboard. The list now has a solid background and sits above the menu. The profile menu at the top right (on a computer) got the same fix.',
      },
      {
        kind: 'improved',
        title: 'Revenue shows this month first',
        text: 'The Dashboard’s Rental Revenue and the Sales page now open on This Month (rentals picked up this calendar month) instead of all time. Both also have new This Year and Last Year buttons next to All Time (rentals picked up in that calendar year). Sales still has Today and Custom.',
        link: '/admin/sales',
      },
      {
        kind: 'data',
        title: 'New expenses: W 9490 C’s tailgate absorbers and rear mirror',
        text: 'Expenses now has the NV200 W 9490 C’s new tailgate absorbers (the pair that holds the rear door up) and its new interior rear-view mirror, both bought online and fitted on 7 Nov. Each has its order and the photos, and shows on the car’s history.',
        link: '/admin/expenses',
      },
      {
        kind: 'new',
        title: 'Customers see where to pay: bank account and DuitNow QR',
        text: 'At checkout (the deposit) and in My Bookings (the rental payment), customers of BuBat Resources’ cars now see its RHB account, 2570 1400 0073 29 (BUBAT RESOURCES), with Copy buttons, the DuitNow QR with a Save button, the amount and the booking code to use as the transfer reference. They no longer need to WhatsApp you for the bank details. Bocah Trading’s cars still ask customers to WhatsApp for the details until Bocah’s account is added.',
      },
      {
        kind: 'new',
        title: 'GDL for commercial vehicles',
        text: 'Customers can add their GDL (Goods Driving Licence) in Verify Account: its expiry date and a photo. It’s optional, but the panel vans are now set to Commercial vehicle (GDL required) in Cars, so customers need a GDL valid until the return date to book one online. The car page says so, and checkout sends customers without one to add it. A GDL sent after verification comes to you as GDL to review in Customers. You can also add one with Edit Customer Details (GDL expiry and image). Book for Customer and the Counter aren’t blocked: Book for Customer warns you, and the booking page shows the customer’s GDL to check at handover. The rental agreement now says a GDL is needed only for commercial vehicles (panel vans).',
        link: '/admin/customers',
      },
      {
        kind: 'fixed',
        title: 'Clearer upload messages instead of “Failed to fetch”',
        text: 'A customer verifying on an Android phone got only “Failed to fetch” when the IC photo or PDF they chose was in Google Drive or Google Photos rather than on the phone. Uploads now check the file first and say what to do: take a photo or screenshot of the document and choose that. If the internet drops during an upload, it tries once more by itself. This covers every upload: IC, licence, receipts and documents. Troubleshooting in the User Manual has the messages.',
        link: '/admin/upload-logs',
      },
    ],
  },
  {
    date: '2026-11-06',
    items: [
      {
        kind: 'data',
        title: 'New expenses: W 9490 C’s air-con and tyres, VEY 3830’s driver seat',
        text: 'Expenses now has the NV200 W 9490 C’s air-con repair and its 4 new tyres (6 Nov), and the Gran Max VEY 3830’s driver seat cushion recovered (4 Nov, in Bocah Trading’s expenses). Each has its bill, the payment slip and the photos, and shows on the car’s history.',
        link: '/admin/expenses',
      },
      {
        kind: 'data',
        title: 'New inside photos: VEY 3830',
        text: 'The Gran Max VEY 3830 has 7 more photos, taken on 6 Nov: the dashboard, the newly covered driver seat, the cab, and the cargo area with its partition. Its main picture is unchanged.',
        link: '/admin/cars',
      },
    ],
  },
  {
    date: '2026-11-04',
    items: [
      {
        kind: 'data',
        title: 'The Vellfire VJC 5290 is back in BuBat Resources',
        text: 'The Vellfire belongs to BuBat Resources again, with all its records: its October expenses and the GPS renewal of 12 Oct moved back with it, so its rentals, expenses and documents are all in BuBat Resources. It keeps its long-term discounts of 20% off for 7 days or more and 25% off for 30 days or more, as its own. Its price and WhatsApp contact are unchanged.',
        link: '/admin/cars',
      },
      {
        kind: 'data',
        title: 'New photos: VEY 3516, VEY 3830 and the Vellfire',
        text: 'The NV200 VEY 3516 now has a gallery of the owner’s photos (front, side and rear) instead of the stock picture. The Gran Max VEY 3830 has three new photos (side, sliding door open and cargo area) and a new main picture. The Vellfire VJC 5290 has one more photo of its middle-row seats. The door sticker with the company address is blurred on every van photo, including VEY 3830’s older ones.',
        link: '/admin/cars',
      },
      {
        kind: 'data',
        title: 'Refund on the 3-van rental recorded',
        text: 'The RM548.39 refunded to Azka SW Legacy on 4 Nov is noted on the last bookings of WA 5202 F, W 9490 C and VEY 3830, with the DuitNow reference and a link to the slip in Telegram.',
        link: '/admin/bookings',
      },
      {
        kind: 'data',
        title: 'Insurance policies for the Vellfire and the Veloz',
        text: 'In Car Documents, the Vellfire VJC 5290’s insurance (Liberty, 6 Aug 2026 – 5 Aug 2027) now has the full policy PDF next to the agent’s quote, with the premium from the policy. The Veloz VQB 5567 now has its insurance on record (Tokio Marine, 27 Nov 2025 – 26 Nov 2026) with the policy PDF, so its renewal on 26 Nov shows in the expiry alerts.',
        link: '/admin/car-documents',
      },
    ],
  },
  {
    date: '2026-11-03',
    items: [
      {
        kind: 'data',
        title: 'The 3-van rental’s last weeks corrected',
        text: 'The long rental of WA 5202 F, W 9490 C and VEY 3830 now ends on the days the vans were last used: VEY 3830 on 15 Sep, when it went to the workshop, and the other two on 12 Oct. Each booking shows the change, and the unused days are marked as rent to refund by hand. The deposit stays held until it is returned.',
        link: '/admin/cars',
      },
    ],
  },
  {
    date: '2026-11-02',
    items: [
      {
        kind: 'new',
        title: 'Long-term bookings on each car, as on Trevo',
        text: 'When you add or edit a car in Cars, the Long-term bookings switch turns its discount for long rentals on or off. When on, set the % off for 7 days or more and for 30 days or more, or leave a box blank to use the fleet’s discount from Fleet Settings. The form shows what the customer pays a week or a month, and a day. The car list shows each car’s discounts under its price. Bookings already made keep their price.',
        link: '/admin/cars',
      },
      {
        kind: 'data',
        title: 'Trevo’s long-term discounts: Bocah Trading, Veloz and Alza',
        text: 'Bocah Trading’s discounts are now 20% off for 7 days or more and 25% off for 30 days or more, as on Trevo, for all its cars (they were 0%). The Veloz VQB 5567 and Alza PRE 4166 have their own 20% and 25%; the other BuBat Resources cars keep 10% and 40%.',
        link: '/admin/cars',
      },
      {
        kind: 'data',
        title: 'Lower daily rates: Vellfire, Veloz and Alza',
        text: 'Vellfire VJC 5290 is now RM400 a day (was RM700), Veloz VQB 5567 RM200 (was RM260) and Alza PRE 4166 RM180 (was RM230), to compete with Trevo. Bookings already made keep their price.',
        link: '/admin/cars',
      },
    ],
  },
  {
    date: '2026-11-01',
    items: [
      {
        kind: 'data',
        title: 'Car history since January 2025: the Alza PRE 4166 and the Veloz VQB 5567',
        text: 'Every 2025 rental of the Alza PRE 4166, and of the Veloz VQB 5567 since it arrived in December 2025, is now on the car’s History and in Customer History: the renter’s name where the receipts show it, each payment checked against the bank statement, and deposits and refunds. Their 2025 repairs, renewals, loan instalments and other costs are there too, with receipts and payment slips, and the Alza’s 2025–26 road tax and insurance are in Car Documents → History. Their 2026 records were already there.',
        link: '/admin/cars',
      },
      {
        kind: 'data',
        title: 'The Ranger’s road tax and insurance are in Bocah Trading’s expenses',
        text: 'The Ford Ranger VDM 6927’s road tax and insurance renewed on 18 Oct 2026 are now expenses of Bocah Trading, with their receipts, and on the car’s history. They were paid just before the Ranger moved to Bocah.',
        link: '/admin/expenses',
      },
      {
        kind: 'fixed',
        title: 'Receipts on more expenses in vehicle history',
        text: 'Loan instalments, a few older bills and the October GPS renewals now have their receipt or bank screen attached, so Receipt on the car’s history opens it. Only costs with no receipt anywhere (such as a monthly instalment kept in the workbook) still have none.',
        link: '/admin/cars',
      },
    ],
  },
  {
    date: '2026-10-30',
    items: [
      {
        kind: 'improved',
        title: 'View a car’s current documents in one click',
        text: 'In Car Documents, each road tax, insurance, Puspakom and GPS date now has a View file button (File 1, File 2… when there are several) that opens its receipt or certificate, so you don’t need to open History.',
        link: '/admin/car-documents',
      },
      {
        kind: 'fixed',
        title: 'A car’s documents show in its new fleet',
        text: 'When a car moves to another fleet, the documents its old fleet recorded now show in the new fleet’s Car Documents and on the car’s vehicle history too: road tax, insurance, Puspakom and GPS with their dates, so the new fleet knows the car is covered before renting it out, and gets the expiry alerts. Their cost stays with the old fleet. VEY 3830 and the Vellfire VJC 5290 in Bocah Trading show theirs again. If a page still shows no documents, reload it.',
        link: '/admin/car-documents',
      },
      {
        kind: 'improved',
        title: 'Open the files of a car’s earlier documents',
        text: 'For a car that moved to your fleet, History in Car Documents now has the files of the documents its old fleet recorded (receipt, certificate, cover note or road tax disc), so you can show them when needed, e.g. after an accident. Only the fleet that recorded a document can remove it.',
        link: '/admin/car-documents',
      },
    ],
  },
  {
    date: '2026-10-29',
    items: [
      {
        kind: 'data',
        title: 'WA 5202 F road tax renewed',
        text: 'The NV200 WA 5202 F has a new road tax, valid 28 Oct 2026 to 15 Mar 2027, with the agent’s receipt and the road tax disc in Car Documents, so its expired road tax alert is gone. Its 29 Oct bills (new battery and the road tax) are in Expenses and on the car’s history.',
        link: '/admin/car-documents',
      },
      {
        kind: 'data',
        title: 'WA 5202 F can be booked again',
        text: 'With its road tax renewed, the NV200 WA 5202 F has valid road tax, insurance, Puspakom and GPS, so it is back on the website for customers to book.',
        link: '/admin/cars',
      },
      {
        kind: 'data',
        title: 'The Gran Max VEY 3830 is now in Bocah Trading',
        text: 'From October 2026 VEY 3830 belongs to Bocah Trading, the same way as the Vellfire: its October expenses moved with it. Its earlier rentals (including the 3-van rental that ended 13 Oct), expenses and documents stay with BuBat Resources. Its WhatsApp contact is unchanged.',
        link: '/admin/cars',
      },
    ],
  },
  {
    date: '2026-10-28',
    items: [
      {
        kind: 'data',
        title: 'Owner’s photos of WB 4690 R',
        text: 'The Gran Max WB 4690 R now has a gallery of the owner’s photos (front, rear, side, cabin and cargo area) instead of the stock picture.',
        link: '/admin/cars',
      },
      {
        kind: 'fixed',
        title: 'Company address hidden on the van photos',
        text: 'The door sticker with the company address is now blurred on the photos of WB 4690 R, W 9490 C and WA 5202 F.',
        link: '/admin/cars',
      },
    ],
  },
  {
    date: '2026-10-26',
    items: [
      {
        kind: 'improved',
        title: 'Car links show the plate',
        text: 'A car’s page is now rent2go.my/cars/ plus its plate without spaces, e.g. rent2go.my/cars/vjc5290 for the Vellfire, so links are easy to read and share. Older links with a long code still work and switch to the new address.',
        link: '/admin/cars',
      },
      {
        kind: 'data',
        title: 'The Vellfire VJC 5290 is now in Bocah Trading',
        text: 'From October 2026 the Vellfire belongs to Bocah Trading, starting fresh: its October expenses and the GPS renewal of 12 Oct moved with it. Its earlier rentals, expenses and documents stay with BuBat Resources. Its WhatsApp contact is unchanged.',
        link: '/admin/cars',
      },
      {
        kind: 'data',
        title: 'Owner’s photos of WA 5202 F',
        text: 'The NV200 WA 5202 F now has a gallery of the owner’s photos (front, rear, cabin and cargo area) instead of the stock picture.',
        link: '/admin/cars',
      },
    ],
  },
  {
    date: '2026-10-25',
    items: [
      {
        kind: 'fixed',
        title: 'Invoice and agreement pages no longer reload themselves',
        text: 'An open invoice or rental agreement kept loading itself again and again, which slowed the website down and, when a load failed, piled up “Failed to load invoice” messages. They now load once. Reload any invoice or agreement tab that was already open.',
      },
    ],
  },
  {
    date: '2026-10-24',
    items: [
      {
        kind: 'data',
        title:
          'Car history since January 2025: VEY 3516, VEY 3830, W 9490 C, WA 5202 F, WB 4690 R and the Vellfire VJC 5290',
        text: 'Every rental of VEY 3516, VEY 3830, W 9490 C, WA 5202 F, WB 4690 R and the Vellfire VJC 5290 since January 2025 is now on the car’s History and in Customer History: the renter’s name where the receipts show it, each payment checked against the bank statement, deposits and refunds, and van exchanges. Runners, Grab and repairs a renter paid for are charges on the booking, matched by the car’s expense. Their repairs, renewals and loan instalments are there too, each with its receipts, payment slip and a link to the Telegram post. Older road tax, insurance, Puspakom and GPS are in Car Documents → History. The other cars follow one by one.',
        link: '/admin/cars',
      },
      {
        kind: 'fixed',
        title: 'Corrections from the latest Telegram messages (BuBat Resources)',
        text: 'A monthly rental settled with the partner is now marked paid, with a note; claims that were paid twice and taken back by contra say so on the expense. Two expenses the import recorded twice are titled “DUPLICATE – delete” so they can be removed in Expenses. The Vellfire’s insurer is now on its Car Documents record.',
        link: '/admin/expenses',
      },
    ],
  },
  {
    date: '2026-10-23',
    items: [
      {
        kind: 'new',
        title: "What's New",
        text: 'This page. Every update to the website is listed here, newest first. The menu shows a dot when there is something you haven’t seen.',
      },
      {
        kind: 'data',
        title: 'Cars moved between fleets',
        text: 'W 9490 C and VEY 3516 are back in BuBat Resources, and the Ford Ranger VDM 6927 is now in Bocah Trading. Their car documents moved with them; their WhatsApp contact is unchanged.',
        link: '/admin/cars',
      },
      {
        kind: 'improved',
        title: 'User Manual up to date',
        text: 'The manual now covers what fleets share, credit per fleet and the Counter in every section, including Troubleshooting.',
        link: '/admin/manual',
      },
    ],
  },
  {
    date: '2026-10-22',
    items: [
      {
        kind: 'new',
        title: 'The Counter',
        text: 'Record any rental in a few taps: a new booking, a car on rent now (a WhatsApp deal) or a past rental already paid. A name and phone are enough. Cars that are out get Add payment, Mark returned and the rental changes, and chips list overdue returns, rent owed and deposits to refund.',
        link: '/admin/counter',
      },
      {
        kind: 'rule',
        title: 'Credit belongs to the fleet that gave it',
        text: 'A customer’s credit (returned deposits) only pays deposits for that fleet’s cars, and only that fleet can refund or deduct it. Customers see their credit per rental company on My Profile.',
        link: '/admin/customers',
      },
      {
        kind: 'rule',
        title: 'Fleets share customers, not money',
        text: 'Customer History also lists a customer’s rentals with other fleets (dates, car, return, charges; no amounts). Receipts, car documents, booking records, the audit log and upload logs are now for their own fleet only.',
        link: '/admin/customer-history',
      },
      {
        kind: 'new',
        title: 'A WhatsApp contact for each car',
        text: 'Save your own WhatsApp number in Fleet Settings, and choose each car’s WhatsApp contact in Cars → Edit. Customers who pick a car WhatsApp its contact; without one, the fleet’s number.',
        link: '/admin/fleet',
      },
      {
        kind: 'rule',
        title: 'Car documents move with the car',
        text: 'When a car moves to another fleet, its road tax, insurance, Puspakom and GPS records and their alerts go with it.',
        link: '/admin/car-documents',
      },
      {
        kind: 'data',
        title: 'A second fleet: Bocah Trading',
        text: 'Bocah Trading (Iqbal) joined.',
      },
      {
        kind: 'data',
        title: 'New daily rates (BuBat Resources)',
        text: 'Vellfire RM700, Ranger RM380, Veloz RM260, Alza RM230, panel vans RM220 a day; 40% off for 30 days or more. Bookings already made keep their price.',
        link: '/admin/cars',
      },
      {
        kind: 'data',
        title: 'Vellfire gallery',
        text: 'A new photo of the driver’s door and the lit sill plate.',
      },
    ],
  },
  {
    date: '2026-10-21',
    items: [
      {
        kind: 'new',
        title: 'Car Documents with expiry alerts',
        text: 'Record each road tax, insurance, Puspakom and GPS renewal with its receipt. The Dashboard lists documents that have expired or expire within 30 days.',
        link: '/admin/car-documents',
      },
      {
        kind: 'new',
        title: 'Vehicle history and booking records',
        text: 'Each car has a history page, month by month: rentals, payments, expenses and documents. Bookings can keep records such as WhatsApp chat proof and refund slips.',
        link: '/admin/cars',
      },
      {
        kind: 'new',
        title: 'Customer History',
        text: 'Everyone who has rented, with or without an account, grouped by phone number: their rentals, what they paid and what they still owe.',
        link: '/admin/customer-history',
      },
    ],
  },
  {
    date: '2026-10-20',
    items: [
      {
        kind: 'data',
        title: 'Owner’s photos',
        text: 'New photos for the Alza, the NV200 W 9490 C, the Gran Max VEY 3830 and the Vellfire (interior and night shots).',
      },
    ],
  },
  {
    date: '2026-10-19',
    items: [
      {
        kind: 'rule',
        title: 'A day to pay the deposit',
        text: 'A customer at checkout has the car held for 24 hours (or until the pick-up day ends) to sign and pay the deposit, and can carry on from My Bookings.',
      },
      {
        kind: 'rule',
        title: 'Agreement before the deposit',
        text: 'Customers sign the rental agreement at checkout, before paying the deposit.',
      },
      {
        kind: 'new',
        title: 'Licence renewals and bank accounts',
        text: 'Customers can renew their licence and admins review it (🔄 Renewals in Customers). Customers give their bank account when verifying, for deposit refunds.',
        link: '/admin/customers',
      },
      {
        kind: 'new',
        title: 'Needs your attention',
        text: 'The Dashboard lists what to do: deposits to check, documents expiring, deposits on hold, credit owed, renewals and customers to verify.',
        link: '/admin',
      },
    ],
  },
  {
    date: '2026-10-16',
    items: [
      {
        kind: 'new',
        title: 'Change Rental',
        text: 'Change the price, extend, end early or replace the car on a booking. Weekly and monthly long-rental discounts are set in Fleet Settings.',
        link: '/admin/bookings',
      },
      {
        kind: 'new',
        title: 'Counter bookings and Sign at Counter',
        text: 'Book for Customer checks the customer and dates, and the customer can sign the agreement in person.',
      },
      {
        kind: 'new',
        title: 'Workshop payments',
        text: 'Record repairs a customer paid the workshop for, set against what they owe.',
      },
      {
        kind: 'improved',
        title: 'Sales and Expenses',
        text: 'Sales counts rentals by pick-up date. Expenses got fixes for dates, sen, receipts and the audit trail.',
        link: '/admin/sales',
      },
      {
        kind: 'data',
        title: 'Car photos',
        text: 'Owner’s photos for the Veloz (with a gallery on the car page), Vellfire and Ranger.',
      },
    ],
  },
  {
    date: '2026-10-15',
    items: [
      {
        kind: 'new',
        title: 'Charges on return',
        text: 'Add late return, cleaning, fuel or damage charges when a car comes back, or hold the deposit until the repair cost is known.',
      },
      {
        kind: 'rule',
        title: 'Unchecked deposits are released',
        text: 'An online booking whose deposit isn’t verified within 48 hours is released automatically.',
      },
      {
        kind: 'improved',
        title: 'Revenue and the User Manual',
        text: 'Revenue no longer counts deposits, and the admin User Manual was added.',
        link: '/admin/manual',
      },
    ],
  },
  {
    date: '2026-10-14',
    items: [
      {
        kind: 'improved',
        title: 'Security',
        text: 'Each fleet’s admins see only their own fleet’s bookings and money; walk-in customers are created safely; rental agreements are built by the server.',
      },
    ],
  },
  {
    date: '2026-10-11',
    items: [
      {
        kind: 'new',
        title: 'Google sign-in',
        text: 'Customers can sign in with Google. A mobile number is required, and a counter customer is linked to their new account by IC.',
      },
      {
        kind: 'improved',
        title: 'Uploads, privacy and contact number',
        text: 'Uploads no longer hang on phones, documents are private, a privacy policy page was added, and the contact number is +60 19-496 1568.',
      },
    ],
  },
];

/** The newest entry's date (YYYY-MM-DD). */
export const LATEST_CHANGE = CHANGELOG[0]?.date || '';
