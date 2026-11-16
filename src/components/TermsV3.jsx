import { useState } from 'react';
import { TERMS_V3_DATE } from '../utils/terms';

// Version 3 of the rental terms, from 17 Nov 2026: one set for every fleet
// (BuBat Resources and Bocah Trading). Shown in one language at a time, Malay
// first; the Malay text applies if the two differ. Each clause has a short
// title, a text, and optionally a list and a closing text. Clauses are
// numbered straight through; the cross-references (clauses 4, 12, 13) follow
// that numbering. As signed from 17 Nov 2026: don't change the wording, add a
// new version instead (see AgreementTerms.jsx).

const INTRO = {
  ms: {
    text: 'Terma ini terpakai bagi semua sewaan kenderaan melalui Rent2Go (rent2go.my).',
    company: 'Syarikat: pemilik kenderaan yang dinamakan dalam invois Rent2Go, iaitu',
    companies: [
      'Bubat Resources, No. SSM 201603369817 / PG0408963-K; atau',
      'Bocah Trading, No. SSM 202003204563 / 003146703-M.',
    ],
    renter: 'Penyewa: orang atau syarikat yang menandatangani perjanjian ini.',
    language: 'Jika versi Bahasa Melayu dan Bahasa Inggeris berbeza, versi Bahasa Melayu terpakai.',
  },
  en: {
    text: 'These terms apply to every vehicle rental through Rent2Go (rent2go.my).',
    company: 'The company: the vehicle owner named on the Rent2Go invoice, that is',
    companies: [
      'Bubat Resources, SSM 201603369817 / PG0408963-K; or',
      'Bocah Trading, SSM 202003204563 / 003146703-M.',
    ],
    renter: 'The renter: the person or company that signs this agreement.',
    language: 'If the Malay and English versions differ, the Malay version applies.',
  },
};

const SECTIONS = [
  {
    title: { ms: 'A. Tempahan, bayaran & deposit', en: 'A. Booking, payment and deposit' },
    clauses: [
      {
        ms: {
          title: 'Sewa dan deposit',
          text: 'Sewa dan deposit bergantung kepada kenderaan dan tempoh sewa, seperti dalam tempahan dan invois Rent2Go. Deposit dibayar semasa tempahan, atau selewat-lewatnya sebelum kunci diserahkan. Deposit mengesahkan tempahan dan dipegang sebagai deposit keselamatan sehingga kenderaan dipulangkan.',
        },
        en: {
          title: 'Rent and deposit',
          text: 'The rent and deposit depend on the vehicle and the rental period, as shown in the Rent2Go booking and invoice. The deposit is paid when booking, or at the latest before the keys are handed over. It secures the booking and is held as a security deposit until the vehicle is returned.',
        },
      },
      {
        ms: {
          title: 'Bayaran sewa',
          text: 'Sewa penuh dibayar selewat-lewatnya semasa mengambil kenderaan. Sewa bulanan dibayar terlebih dahulu setiap bulan pada tarikh yang dipersetujui.',
        },
        en: {
          title: 'Paying the rent',
          text: 'The full rent is paid at the latest on pick-up. Monthly rent is paid in advance each month on the agreed date.',
        },
      },
      {
        ms: {
          title: 'Menukar tarikh',
          text: 'Tarikh boleh ditukar tanpa caj dengan notis sekurang-kurangnya 3 hari sebelum tarikh ambil, ke tarikh dalam tempoh 1 bulan, jika kenderaan ada. Jika tarikh baharu tidak ditetapkan dalam tempoh 1 bulan itu, tempahan dikira dibatalkan kurang 3 hari sebelum tarikh ambil (klausa 4).',
        },
        en: {
          title: 'Moving the dates',
          text: "The dates can be moved free of charge with at least 3 days' notice before the pick-up date, to dates within 1 month, if the vehicle is free. If no new date is set within that month, the booking counts as cancelled less than 3 days before pick-up (clause 4).",
        },
      },
      {
        ms: {
          title: 'Membatalkan sebelum mengambil kenderaan',
          items: [
            '3 hari atau lebih sebelum tarikh ambil: deposit dikembalikan sepenuhnya, atau disimpan sebagai kredit.',
            'Kurang 3 hari sebelum tarikh ambil: penalti 25% daripada jumlah sewa, ditolak daripada deposit.',
          ],
        },
        en: {
          title: 'Cancelling before pick-up',
          items: [
            '3 days or more before the pick-up date: the deposit is refunded in full, or kept as credit.',
            'Less than 3 days before the pick-up date: a penalty of 25% of the rental total, taken from the deposit.',
          ],
        },
      },
      {
        ms: {
          title: 'Melanjutkan sewa',
          text: 'Maklumkan syarikat sekurang-kurangnya 24 jam sebelum masa pemulangan. Lanjutan tertakluk kepada kekosongan kenderaan dan dikenakan kadar semasa.',
        },
        en: {
          title: 'Extending',
          text: 'Tell the company at least 24 hours before the return time. An extension depends on the vehicle being free and is charged at the current rate.',
        },
      },
      {
        ms: {
          title: 'Memendekkan sewa',
          text: 'Jika penyewa memendekkan sewa atau memulangkan kenderaan lebih awal (termasuk sewa bulanan), penalti 25% daripada sewa bagi hari yang tidak digunakan dikenakan. Baki sewa hari tersebut dikembalikan, atau disimpan sebagai kredit.',
        },
        en: {
          title: 'Ending early',
          text: 'If the renter shortens the rental or returns the vehicle early (monthly rentals included), a penalty of 25% of the rent for the unused days applies. The rest of that rent is refunded, or kept as credit.',
        },
      },
      {
        ms: {
          title: 'Pemulangan deposit',
          text: 'Deposit dikembalikan dalam tempoh 7 hari bekerja selepas kenderaan dipulangkan, atau disimpan sebagai kredit untuk sewaan seterusnya jika penyewa mahu, selepas ditolak sewa tertunggak dan caj di bawah perjanjian ini. Deposit boleh ditahan sehingga kos kerosakan diketahui atau tuntutan insurans selesai.',
        },
        en: {
          title: 'Deposit refund',
          text: 'The deposit is refunded within 7 working days after the vehicle is returned, or kept as credit for the next rental if the renter prefers, less unpaid rent and charges under this agreement. It may be held until the cost of damage is known or an insurance claim is settled.',
        },
      },
      {
        ms: {
          title: 'Jika syarikat tidak dapat menyediakan kenderaan',
          text: 'Jika syarikat membatalkan tempahan, tidak dapat menyediakan kenderaan yang selamat dengan cukai jalan dan insurans yang sah, atau mengambil balik kenderaan tanpa kesalahan penyewa, semua deposit dan sewa bagi hari yang tidak digunakan dikembalikan sepenuhnya tanpa potongan. Kenderaan lain boleh disediakan jika penyewa bersetuju.',
        },
        en: {
          title: 'If the company cannot provide the vehicle',
          text: 'If the company cancels the booking, cannot provide a safe vehicle with valid road tax and insurance, or takes the vehicle back without the renter being at fault, the whole deposit and the rent for unused days are refunded in full without deductions. Another vehicle can be provided instead if the renter agrees.',
        },
      },
    ],
  },
  {
    title: { ms: 'B. Dokumen & pemandu', en: 'B. Documents and drivers' },
    clauses: [
      {
        ms: {
          title: 'Dokumen kenderaan',
          text: 'Syarikat memastikan cukai jalan, insurans dan Puspakom (bagi kenderaan perdagangan) sah sepanjang tempoh sewa. Salinannya ada dalam kenderaan atau di My Bookings di Rent2Go. Kenderaan diserahkan dalam keadaan bersih, selamat dan berfungsi.',
        },
        en: {
          title: 'Vehicle documents',
          text: 'The company keeps the road tax, insurance and Puspakom inspection (for commercial vehicles) valid for the whole rental. Copies are in the vehicle or in My Bookings on Rent2Go. The vehicle is handed over clean, safe and in working order.',
        },
      },
      {
        ms: {
          title: 'Dokumen penyewa',
          text: 'Sebelum kenderaan diserahkan, penyewa menunjukkan dokumen asal:',
          items: [
            'MyKad atau pasport;',
            'lesen memandu Malaysia Kelas D;',
            'GDL Kelas D, bagi van panel dan kenderaan perdagangan lain;',
            'bagi sewaan atas nama syarikat: dokumen pendaftaran SSM dan surat lantikan pemandu.',
          ],
          after: 'Syarikat boleh menyalin dan menyimpan dokumen ini seperti dalam Dasar Privasi.',
        },
        en: {
          title: "The renter's documents",
          text: 'Before handover, the renter shows the originals of:',
          items: [
            'MyKad or passport;',
            'a Malaysian Class D driving licence;',
            'a Class D GDL, for panel vans and other commercial vehicles;',
            "for a rental in a company's name: its SSM registration and a letter appointing the driver.",
          ],
          after: 'The company may copy and keep these, as set out in the Privacy Policy.',
        },
      },
      {
        ms: {
          title: 'Pemandu',
          text: 'Hanya penyewa dan pemandu yang diluluskan syarikat boleh memandu, masing-masing dengan lesen (dan GDL bagi kenderaan perdagangan) yang sah sepanjang tempoh sewa. Untuk menukar atau menambah pemandu, dapatkan kelulusan syarikat dahulu. Penyewa bertanggungjawab atas setiap pemandu. Kenderaan tidak boleh disewakan semula, dipinjamkan atau diserahkan kepada orang lain.',
        },
        en: {
          title: 'Drivers',
          text: "Only the renter and drivers the company has approved may drive, each with a valid licence (and GDL for commercial vehicles) for the whole rental. To change or add a driver, get the company's approval first. The renter is responsible for every driver. The vehicle may not be rented out again, lent or handed to anyone else.",
        },
      },
    ],
  },
  {
    title: { ms: 'C. Penggunaan kenderaan', en: 'C. Using the vehicle' },
    clauses: [
      {
        ms: {
          title: 'Penggunaan yang sah',
          text: 'Kenderaan digunakan untuk tujuan yang sah sahaja, mematuhi Akta Pengangkutan Jalan 1987, had laju dan had muatan. Dilarang:',
          items: [
            'pengedaran dadah, perlumbaan atau perjudian;',
            'memandu di bawah pengaruh alkohol atau dadah;',
            'muatan melebihi had berat yang dibenarkan;',
            'barang berbahaya, mudah terbakar atau beracun;',
            'menarik kenderaan lain;',
            'e-hailing penumpang (Grab dan sebagainya) tanpa kebenaran bertulis syarikat.',
          ],
          after:
            'Penghantaran barang dengan van panel (cth. Lalamove) dibenarkan jika pemandu mempunyai GDL yang sah.',
        },
        en: {
          title: 'Lawful use',
          text: 'Lawful use only, keeping to the Road Transport Act 1987, speed limits and load limits. Not allowed:',
          items: [
            'drug trafficking, racing or gambling;',
            'driving under the influence of alcohol or drugs;',
            'loads over the permitted weight;',
            'dangerous, flammable or toxic goods;',
            'towing other vehicles;',
            "passenger e-hailing (Grab and the like) without the company's written permission.",
          ],
          after:
            'Goods delivery with a panel van (e.g. Lalamove) is allowed when the driver holds a valid GDL.',
        },
      },
      {
        ms: {
          title: 'Kawasan',
          text: 'Semenanjung Malaysia sahaja. Tidak dibenarkan ke Singapura, Thailand, Sabah atau Sarawak tanpa kebenaran bertulis syarikat.',
        },
        en: {
          title: 'Area',
          text: "Peninsular Malaysia only. Not to Singapore, Thailand, Sabah or Sarawak without the company's written permission.",
        },
      },
      {
        ms: {
          title: 'Serahan dan pemulangan',
          text: 'Sebelum bertolak, periksa kenderaan bersama syarikat dan rekod (gambar atau video) sebarang kerosakan sedia ada, paras minyak dan bacaan odometer. Kerosakan baharu yang tidak direkod semasa serahan dianggap berlaku dalam tempoh sewa. Semasa pemulangan, kenderaan diperiksa bersama.',
        },
        en: {
          title: 'Pick-up and return',
          text: 'Before driving off, check the vehicle with the company and record (photos or video) any existing damage, the fuel level and the mileage. New damage not recorded at pick-up is taken to have happened during the rental. On return, the vehicle is inspected together.',
        },
      },
      {
        ms: {
          title: 'Minyak dan kebersihan',
          text: 'Pulangkan kenderaan dengan paras minyak yang sama; jika kurang, kos minyak untuk mengisi semula dikenakan. Pulangkan dalam keadaan bersih; jika tidak, caj pembersihan RM30 dikenakan.',
        },
        en: {
          title: 'Fuel and cleaning',
          text: 'Return the vehicle with the same fuel level; if it is lower, the fuel to refill it is charged. Return it clean; if not, a RM30 cleaning charge applies.',
        },
      },
      {
        ms: {
          title: 'Kos semasa sewa dan saman',
          text: "Penyewa menanggung minyak, tol (termasuk tol yang ditolak daripada kad Touch 'n Go atau RFID kenderaan), parking, dan semua saman dan kompaun dalam tempoh sewa, termasuk yang diterima selepas kenderaan dipulangkan atau deposit dikembalikan. Syarikat boleh memberi butiran penyewa kepada PDRM, JPJ, pihak berkuasa tempatan atau syarikat tol untuk memindahkan saman atau caj kepada penyewa.",
        },
        en: {
          title: 'Running costs and summonses',
          text: "The renter pays fuel, tolls (including tolls taken from a Touch 'n Go card or RFID linked to the vehicle), parking, and every summons and compound from the rental, including those that arrive after the vehicle is returned or the deposit is refunded. The company may give the renter's details to the police (PDRM), JPJ, local councils or toll operators to transfer a summons or charge to the renter.",
        },
      },
      {
        ms: {
          title: 'Lewat memulangkan kenderaan',
          text: 'Caj lewat:',
          items: [
            'RM10 sejam: kenderaan bawah 1300cc;',
            'RM15 sejam: 1300cc hingga 1699cc;',
            'RM20 sejam: 1700cc ke atas.',
          ],
          after:
            'Lewat lebih 5 jam dikira sewa sehari penuh. Jika kenderaan tidak dipulangkan dan penyewa tidak dapat dihubungi lebih 24 jam selepas masa pemulangan, syarikat boleh mengambil semula kenderaan dan membuat laporan polis.',
        },
        en: {
          title: 'Late return',
          text: 'Late return is charged:',
          items: [
            'RM10 an hour: vehicles under 1300cc;',
            'RM15 an hour: 1300cc to 1699cc;',
            'RM20 an hour: 1700cc and above.',
          ],
          after:
            'More than 5 hours late is charged as a full extra day. If the vehicle is not returned and the renter cannot be reached for more than 24 hours after the return time, the company may take the vehicle back and make a police report.',
        },
      },
      {
        ms: {
          title: 'GPS',
          text: 'Kenderaan mungkin dipasang GPS untuk keselamatan. Lokasinya boleh dipantau sepanjang tempoh sewa dan digunakan untuk keselamatan, mendapatkan semula kenderaan, dan menyiasat kemalangan atau saman (lihat Dasar Privasi).',
        },
        en: {
          title: 'GPS',
          text: "Vehicles may be fitted with GPS for security. The vehicle's location may be tracked during the rental and used for security, getting the vehicle back, and looking into accidents or summonses (see the Privacy Policy).",
        },
      },
    ],
  },
  {
    title: { ms: 'D. Penjagaan & kerosakan kenderaan', en: 'D. Care and breakdowns' },
    clauses: [
      {
        ms: {
          title: 'Servis',
          text: 'Syarikat menanggung servis berkala dan kerosakan akibat haus dan lusuh biasa atau masalah sedia ada. Servis dan pembaikan hanya di bengkel syarikat, atau bengkel lain dengan kelulusan syarikat. Bagi sewa panjang, bawa kenderaan untuk servis apabila diminta.',
        },
        en: {
          title: 'Servicing',
          text: "The company pays for routine servicing and for breakdowns from normal wear and tear or existing faults. Servicing and repairs are done only at the company's workshop, or another workshop the company approves. On a long rental, bring the vehicle in for service when asked.",
        },
      },
      {
        ms: {
          title: 'Pemeriksaan berkala',
          text: 'Penyewa memeriksa secara berkala:',
          items: ['air dan kipas radiator;', 'minyak enjin;', 'tekanan dan keadaan tayar.'],
          after:
            'Jika lampu amaran menyala atau ada masalah, berhenti dengan selamat dan hubungi syarikat. Kerosakan akibat tidak membuat pemeriksaan ini, atau terus memandu selepas amaran, ditanggung penyewa.',
        },
        en: {
          title: 'Regular checks',
          text: 'The renter checks regularly:',
          items: [
            'the radiator coolant and fan;',
            'the engine oil;',
            "the tyres' pressure and condition.",
          ],
          after:
            "If a warning light comes on or something seems wrong, stop safely and call the company. Damage from skipping these checks, or from carrying on driving after a warning, is the renter's.",
        },
      },
      {
        ms: {
          title: 'Kenderaan rosak sendiri',
          text: 'Jika kenderaan rosak kerana kenderaan itu sendiri (bukan disebabkan penyewa), maklumkan syarikat dengan segera. Syarikat akan menyediakan kenderaan gantian yang setara dalam 24 jam jika ada. Jika tiada, sewa bagi hari yang terjejas tidak dikenakan: dikembalikan, atau sewa dilanjutkan dengan bilangan hari yang sama tanpa caj, mengikut pilihan penyewa. Jangan baiki sendiri tanpa kebenaran syarikat; kos pembaikan yang diluluskan dibayar balik atau ditolak daripada sewa, dengan resit.',
        },
        en: {
          title: 'Breakdowns',
          text: "If the vehicle breaks down through its own fault, not the renter's, tell the company straight away. The company provides a similar replacement vehicle within 24 hours when one is available. If none is, the affected days are not charged: refunded, or the rental extended by the same number of days free, as the renter chooses. Do not repair it yourself without the company's permission; approved repair costs are paid back or taken off the rent, with the receipt.",
        },
      },
    ],
  },
  {
    title: { ms: 'E. Kemalangan, kerosakan & kehilangan', en: 'E. Accidents, damage and loss' },
    clauses: [
      {
        ms: {
          title: 'Tanggungjawab penyewa',
          text: 'Penyewa bertanggungjawab atas kehilangan atau kerosakan pada kenderaan dan peralatannya sepanjang tempoh sewa, walau apa pun puncanya (perlanggaran, kebakaran, banjir, vandalisme, kecurian dan sebagainya), kecuali kerosakan atau kecacatan kenderaan itu sendiri.',
        },
        en: {
          title: "The renter's responsibility",
          text: 'The renter is responsible for loss of or damage to the vehicle and its equipment during the rental, whatever the cause (collision, fire, flood, vandalism, theft and so on), except a fault or defect of the vehicle itself.',
        },
      },
      {
        table: true,
        ms: {
          title: 'Jumlah yang dibayar penyewa',
          text: 'Bagi setiap kejadian, penyewa membayar kos sebenar, sehingga had maksimum dalam jadual di bawah mengikut cc kenderaan dan tempoh di bengkel. Kos sebenar termasuk:',
          items: [
            'pembaikan yang tidak dibayar insurans;',
            'lebihan (excess) insurans dan kos tuntutan;',
            'diskaun tanpa tuntutan (NCD) yang hilang;',
            'sewa yang hilang semasa kenderaan di bengkel.',
          ],
          after: 'Bayaran perlu dibuat serta-merta dan boleh ditolak daripada deposit.',
        },
        en: {
          title: 'How much the renter pays',
          text: "For each incident the renter pays the actual cost, up to the maximum in the table below for the vehicle's engine size and how long it is in the workshop. The actual cost covers:",
          items: [
            'repairs insurance does not pay;',
            'the insurance excess and claim costs;',
            'the lost no-claim discount (NCD);',
            'the rent lost while the vehicle is in the workshop.',
          ],
          after: 'The amount is due straight away and may be taken from the deposit.',
        },
      },
      {
        ms: {
          title: 'Kecurian atau hapus kira',
          text: 'Jika kenderaan dicuri atau hapus kira (total loss), penyewa membayar amaun "Bengkel lebih 7 hari" bagi cc kenderaan, dengan syarat laporan polis dibuat dalam 24 jam dan semua kunci dipulangkan.',
        },
        en: {
          title: 'Theft or write-off',
          text: 'If the vehicle is stolen or written off, the renter pays the "Workshop over 7 days" amount for its engine size, provided a police report was made within 24 hours and all keys are returned.',
        },
      },
      {
        ms: {
          title: 'Bila had jadual tidak terpakai',
          text: 'Penyewa menanggung kos penuh yang tidak dibayar insurans, tanpa had jadual, jika:',
          items: [
            'pemandu tidak diluluskan, atau tiada lesen atau GDL yang sah;',
            'pemandu di bawah pengaruh alkohol atau dadah;',
            'pemanduan berbahaya atau kesalahan jalan raya yang serius (cth. melanggar lampu merah, memandu jauh melebihi had laju);',
            'kenderaan digunakan seperti yang dilarang dalam klausa 12, atau di luar kawasan dalam klausa 13;',
            'kunci ditinggalkan dalam kenderaan, atau kenderaan tidak dikunci;',
            'laporan polis tidak dibuat dalam 24 jam;',
            'insurans menolak tuntutan kerana kesalahan penyewa.',
          ],
          after:
            'Bagi kecurian atau hapus kira dalam keadaan ini, kos penuh termasuk baki yang tidak dibayar insurans, kos tunda, kos pentadbiran dan sewa yang hilang semasa kenderaan tidak dapat digunakan.',
        },
        en: {
          title: 'When the table limits do not apply',
          text: 'The renter pays the full cost insurance does not pay, with no table limit, if:',
          items: [
            'the driver was not approved, or had no valid licence or GDL;',
            'the driver was under the influence of alcohol or drugs;',
            'the vehicle was driven dangerously or with a serious traffic offence (e.g. running a red light, far over the speed limit);',
            'the vehicle was used as forbidden in clause 12, or outside the area in clause 13;',
            'the keys were left in the vehicle, or it was left unlocked;',
            'no police report was made within 24 hours;',
            "insurance refuses the claim because of the renter's fault.",
          ],
          after:
            'For theft or a write-off in these cases, the full cost includes what insurance does not pay, towing, admin costs and the rent lost while the vehicle cannot be used.',
        },
      },
      {
        letters: true,
        ms: {
          title: 'Selepas kemalangan, kecurian atau kehilangan',
          items: [
            'maklumkan syarikat dengan segera, selewat-lewatnya dalam 12 jam;',
            'buat laporan polis dalam 24 jam, seperti yang diwajibkan undang-undang;',
            'ambil gambar kenderaan, tempat kejadian dan butiran pihak lain;',
            'jangan mengaku salah atau berunding dengan pihak lain;',
            'jangan baiki atau tunda kenderaan tanpa kebenaran syarikat.',
          ],
        },
        en: {
          title: 'After an accident, theft or loss',
          items: [
            'tell the company straight away, at the latest within 12 hours;',
            'make a police report within 24 hours, as the law requires;',
            "take photos of the vehicles, the place and the other party's details;",
            'do not admit fault or settle with the other party;',
            "do not repair or tow the vehicle without the company's permission.",
          ],
        },
      },
    ],
  },
  {
    title: { ms: 'F. Penamatan perjanjian', en: 'F. Ending the agreement' },
    clauses: [
      {
        ms: {
          title: 'Penamatan oleh syarikat',
          text: 'Syarikat boleh menamatkan perjanjian serta-merta dan mengambil semula kenderaan jika penyewa melanggar terma penting, contohnya:',
          items: [
            'menyewakan semula kenderaan;',
            'penggunaan yang dilarang;',
            'pemandu yang tidak diluluskan;',
            'sewa bulanan lewat lebih 7 hari.',
          ],
          after:
            'Penyewa hendaklah memulangkan kenderaan dengan segera dan membayar sewa sehingga tarikh itu, caj dan kerosakan di bawah perjanjian ini, serta penalti 25% daripada sewa bagi hari yang tidak digunakan. Jumlah ini boleh ditolak daripada deposit dan sewa yang telah dibayar.',
        },
        en: {
          title: 'Ending by the company',
          text: 'The company may end the agreement immediately and take the vehicle back if the renter breaks an important term, for example:',
          items: [
            'renting the vehicle out again;',
            'forbidden use;',
            'an unapproved driver;',
            'monthly rent more than 7 days late.',
          ],
          after:
            'The renter must return the vehicle straight away and pay the rent up to that day, the charges and damage under this agreement, and the 25% penalty on the rent for the unused days. These may be taken from the deposit and the rent already paid.',
        },
      },
    ],
  },
  {
    title: { ms: 'G. Am', en: 'G. General' },
    clauses: [
      {
        ms: {
          title: 'Pertikaian',
          text: 'Sebarang pertikaian diselesaikan dahulu melalui rundingan dalam tempoh 14 hari. Jika tidak selesai, kedua-dua pihak boleh bersetuju merujuknya kepada pengantara (mediator) di Malaysia. Perjanjian ini tertakluk kepada undang-undang Malaysia, termasuk Akta Kontrak 1950 dan Akta Pengangkutan Jalan 1987.',
        },
        en: {
          title: 'Disputes',
          text: 'Any dispute is first settled by discussion within 14 days. If it is not settled, both parties may agree to refer it to a mediator in Malaysia. This agreement is governed by Malaysian law, including the Contracts Act 1950 and the Road Transport Act 1987.',
        },
      },
      {
        ms: {
          title: 'Perubahan',
          text: 'Perubahan kepada perjanjian ini mesti dipersetujui oleh kedua-dua pihak secara bertulis, termasuk perubahan tarikh, harga atau kenderaan yang direkod di Rent2Go atau dipersetujui melalui WhatsApp atau e-mel. Jika mana-mana terma tidak boleh dikuatkuasakan, terma lain kekal berkuat kuasa.',
        },
        en: {
          title: 'Changes',
          text: 'Changes to this agreement must be agreed by both parties in writing, including changes of dates, price or vehicle recorded on Rent2Go or agreed by WhatsApp or e-mail. If any term cannot be enforced, the other terms still apply.',
        },
      },
      {
        ms: {
          title: 'Tandatangan dalam talian',
          text: 'Menandatangani perjanjian ini di Rent2Go (tandatangan dan kotak persetujuan, dalam talian atau di kaunter) adalah sah sama seperti menandatangani di atas kertas, menurut Akta Perdagangan Elektronik 2006. Perjanjian ini, bersama tempahan dan invois di Rent2Go, ialah keseluruhan perjanjian bagi sewaan ini dan menggantikan terma atau persetujuan lisan sebelum ini, termasuk borang sewa terdahulu syarikat.',
        },
        en: {
          title: 'Signing online',
          text: "Signing this agreement on Rent2Go (the signature and tick box, online or at the counter) is as valid as signing on paper, under the Electronic Commerce Act 2006. This agreement, with the booking and invoice on Rent2Go, is the whole agreement for this rental and replaces earlier terms or verbal agreements, including the companies' earlier rental forms.",
        },
      },
    ],
  },
];

// Each section's first clause number: clauses are numbered straight through
const SECTION_STARTS = SECTIONS.map(
  (_, i) => 1 + SECTIONS.slice(0, i).reduce((n, s) => n + s.clauses.length, 0)
);

// Maximum per incident, by engine size and days in the workshop
const TABLE = {
  ms: {
    headers: ['CC kenderaan', 'Bengkel 1–7 hari', 'Bengkel lebih 7 hari', 'Kerosakan kecil'],
    note: 'Had maksimum setiap kejadian. Kerosakan kecil: dibaiki tanpa kenderaan bermalam di bengkel (cth. calar, cermin sisi).',
    cc: ['999cc ke bawah', '1000–1299cc', '1300–1499cc', '1500–1699cc', '1700cc ke atas'],
  },
  en: {
    headers: ['Engine size', 'Workshop 1–7 days', 'Workshop over 7 days', 'Minor damage'],
    note: 'Maximum per incident. Minor damage: repaired without the vehicle staying overnight in the workshop (e.g. scratches, a side mirror).',
    cc: ['Up to 999cc', '1000–1299cc', '1300–1499cc', '1500–1699cc', '1700cc and above'],
  },
  rows: [
    ['RM2,000', 'RM3,500', 'RM600'],
    ['RM3,000', 'RM4,000', 'RM800'],
    ['RM3,500', 'RM4,500', 'RM1,000'],
    ['RM5,000', 'RM5,000', 'RM1,200'],
    ['RM6,000', 'RM6,000', 'RM1,500'],
  ],
};

function DamageTable({ lang }) {
  const t = TABLE[lang];
  return (
    <div className="mt-3">
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="text-slate-400">
              {t.headers.map((h, i) => (
                <th
                  key={h}
                  className={`border border-white/10 p-2 bg-white/5 font-medium ${i === 0 ? 'text-left' : 'text-center'}`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {TABLE.rows.map((row, r) => (
              <tr key={t.cc[r]} className="text-white">
                <td className="border border-white/10 p-2 text-slate-300 whitespace-nowrap">
                  {t.cc[r]}
                </td>
                {row.map((amount, i) => (
                  <td key={i} className="border border-white/10 p-2 text-center font-medium">
                    {amount}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-500 mt-2">{t.note}</p>
    </div>
  );
}

function ClauseBody({ clause, lang }) {
  const c = clause[lang];
  const List = clause.letters ? 'ol' : 'ul';
  return (
    <>
      <p className="font-semibold text-white">{c.title}</p>
      {c.text && <p className="mt-1">{c.text}</p>}
      {c.items && (
        <List
          className={`mt-1 pl-5 space-y-1 ${clause.letters ? 'list-[lower-alpha]' : 'list-disc'}`}
        >
          {c.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </List>
      )}
      {c.after && <p className="mt-1">{c.after}</p>}
      {clause.table && <DamageTable lang={lang} />}
    </>
  );
}

export default function TermsV3() {
  const [lang, setLang] = useState('ms');
  const intro = INTRO[lang];

  return (
    <>
      <div className="glass-card mb-6 text-sm text-slate-300 leading-relaxed">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
          <div>
            <h2 className="text-lg font-semibold text-white">
              {lang === 'ms' ? 'Terma & Syarat' : 'Terms & Conditions'}
            </h2>
            <p className="text-xs text-slate-500">
              {lang === 'ms'
                ? `Versi 3, berkuat kuasa ${TERMS_V3_DATE}`
                : `Version 3, from ${TERMS_V3_DATE}`}
            </p>
          </div>
          <div
            className="inline-flex rounded-lg bg-white/5 p-1 text-xs print:hidden"
            role="group"
            aria-label="Bahasa / Language"
          >
            {[
              ['ms', 'Bahasa Melayu'],
              ['en', 'English'],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setLang(key)}
                aria-pressed={lang === key}
                className={`px-3 py-1.5 rounded-md transition-colors ${
                  lang === key ? 'bg-violet-500 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <p>{intro.text}</p>
        <p className="mt-2">{intro.company}</p>
        <ul className="list-disc pl-5 mt-1 space-y-1">
          {intro.companies.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
        <p className="mt-2">{intro.renter}</p>
        <p className="mt-2 text-xs text-slate-500">{intro.language}</p>
      </div>

      {SECTIONS.map((section, s) => {
        return (
          <div key={section.title.ms} className="glass-card mb-6">
            <h2 className="text-lg font-semibold text-white mb-4">{section.title[lang]}</h2>
            <ol
              className="list-decimal pl-5 space-y-4 text-sm text-slate-300 leading-relaxed marker:text-slate-500"
              start={SECTION_STARTS[s]}
            >
              {section.clauses.map((clause) => (
                <li key={clause.ms.title}>
                  <ClauseBody clause={clause} lang={lang} />
                </li>
              ))}
            </ol>
          </div>
        );
      })}
    </>
  );
}
