// The rental agreement's terms (Terma & Syarat), shown at signing, on a
// signed agreement and on the public /terms page.
//
// A signed agreement keeps showing the version its renter signed: version 1
// for agreements signed before TERMS_V2_FROM (src/utils/terms.js), version 2
// after. To change the terms again, keep these two as they are and add
// version 3 the same way.

import { TERMS_V2_DATE, termsVersion } from '../utils/terms';

// Damage liability by engine CC (from the Bubat Resources paper form)
const LIABILITY_TABLE = [
  { cc: '999cc dan ke bawah', workshop7: 'RM2,000', workshopMore: 'RM3,500', minor: 'RM600' },
  { cc: '1000cc - 1299cc', workshop7: 'RM3,000', workshopMore: 'RM4,000', minor: 'RM800' },
  { cc: '1300cc - 1499cc', workshop7: 'RM3,500', workshopMore: 'RM4,500', minor: 'RM1,000' },
  { cc: '1500cc - 1699cc', workshop7: 'RM5,000', workshopMore: 'RM5,000', minor: 'RM1,200' },
  { cc: '1700cc dan keatas', workshop7: 'RM6,000', workshopMore: 'RM6,000', minor: 'RM1,500' },
];

function LiabilityTable({ headers }) {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="text-slate-400">
            {headers.map((h, i) => (
              <th
                key={h}
                className={`border border-white/10 p-2 bg-white/5 ${i === 0 ? 'text-left' : 'text-center'}`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {LIABILITY_TABLE.map((row) => (
            <tr key={row.cc} className="text-white">
              <td className="border border-white/10 p-2 text-slate-300">{row.cc}</td>
              <td className="border border-white/10 p-2 text-center font-medium text-yellow-400">
                {row.workshop7}
              </td>
              <td className="border border-white/10 p-2 text-center font-medium text-orange-400">
                {row.workshopMore}
              </td>
              <td className="border border-white/10 p-2 text-center font-medium text-emerald-400">
                {row.minor}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** The terms an agreement signed at `agreedAt` holds; without a date, the current terms. */
export function AgreementTerms({ agreedAt }) {
  return termsVersion(agreedAt) === 1 ? <TermsV1 /> : <TermsV2 />;
}

// ---------------------------------------------------------------------------
// Version 2, from 16 Nov 2026
// ---------------------------------------------------------------------------

const B = ({ children }) => <strong className="text-white">{children}</strong>;
const Y = ({ children }) => <strong className="text-yellow-400">{children}</strong>;

// Each clause in Malay, then English
function Clause({ children, en }) {
  return (
    <li>
      {children}
      <span className="block text-xs text-slate-500 mt-1">{en}</span>
    </li>
  );
}

function Part({ title, titleEn, start, children }) {
  return (
    <div className="glass-card mb-6">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      <p className="text-xs text-slate-500 mb-4">{titleEn}</p>
      <ol
        className="list-decimal pl-5 space-y-3 text-sm text-slate-300 leading-relaxed"
        start={start}
      >
        {children}
      </ol>
    </div>
  );
}

function TermsV2() {
  return (
    <>
      <div className="glass-card mb-6 text-sm text-slate-300 leading-relaxed">
        <h2 className="text-lg font-semibold text-white">TERMA & SYARAT (Terms & Conditions)</h2>
        <p className="text-xs text-slate-500 mb-3">Versi 2, berkuat kuasa {TERMS_V2_DATE}</p>
        <p>
          &quot;Syarikat&quot; ialah pemilik kenderaan yang dinamakan dalam invois Rent2Go.
          &quot;Penyewa&quot; ialah orang yang menandatangani perjanjian ini. Jika versi Bahasa
          Melayu dan Bahasa Inggeris berbeza, versi Bahasa Melayu terpakai.
        </p>
        <p className="text-xs text-slate-500 mt-1">
          &quot;The company&quot; is the vehicle owner named on the Rent2Go invoice. &quot;The
          renter&quot; is the person who signs this agreement. If the Malay and English versions
          differ, the Malay version applies.
        </p>
      </div>

      <Part title="A. SEWAAN" titleEn="The rental" start={1}>
        <Clause en="Pick up and return the vehicle at the agreed date and time. To extend, ask before the return time; an extension depends on the vehicle being free and is charged at the current rate.">
          Penyewa mengambil dan memulangkan kenderaan pada <B>tarikh dan masa yang ditetapkan</B>.
          Untuk melanjutkan sewa, minta <B>sebelum masa pemulangan</B>; lanjutan tertakluk kepada
          kekosongan kenderaan dan dikenakan kadar semasa.
        </Clause>
        <Clause en="Only the renter and drivers the company has approved may drive, each with a valid Malaysian Class D driving licence, and a valid Class D GDL for panel vans and other commercial vehicles, for the whole rental. The renter is responsible for every driver. The vehicle may not be rented out again or handed to anyone else.">
          Hanya penyewa dan pemandu yang <B>diluluskan syarikat</B> boleh memandu, masing-masing
          dengan <B>lesen memandu Malaysia Kelas D</B> yang sah, dan <B>GDL Kelas D</B> yang sah
          bagi van panel dan kenderaan perdagangan lain, sepanjang tempoh sewa. Penyewa
          bertanggungjawab atas setiap pemandu. Kenderaan tidak boleh disewakan semula atau
          diserahkan kepada orang lain.
        </Clause>
        <Clause en="Lawful use only. Not allowed: drug trafficking, racing, gambling, driving under the influence of alcohol or drugs, loads over the permitted weight, towing other vehicles, and passenger e-hailing (Grab and the like) without the company's written permission. Goods delivery with a panel van (e.g. Lalamove) is allowed when the driver holds a valid GDL.">
          Kenderaan digunakan untuk perkara yang <B>mematuhi undang-undang sahaja</B>.{' '}
          <strong className="text-red-400">DILARANG</strong>: pengedaran dadah, perlumbaan,
          perjudian, memandu di bawah pengaruh alkohol atau dadah, muatan melebihi had berat yang
          dibenarkan, menarik kenderaan lain, dan e-hailing penumpang (Grab dan sebagainya) tanpa
          kebenaran bertulis syarikat. Penghantaran barang dengan van panel (cth. Lalamove)
          dibenarkan jika pemandu mempunyai GDL yang sah.
        </Clause>
        <Clause en="Peninsular Malaysia only. Not to Singapore, Thailand, Sabah or Sarawak without the company's written permission.">
          Kenderaan digunakan di <B>Semenanjung Malaysia sahaja</B>. Tidak dibenarkan ke Singapura,
          Thailand, Sabah atau Sarawak tanpa kebenaran bertulis syarikat.
        </Clause>
        <Clause en="Before driving off, check the vehicle with the company and record (photos or video) any existing damage, the fuel level and the mileage. New damage not recorded at pick-up is taken to have happened during the rental. Return the vehicle with the same fuel level (if lower, the fuel to refill it is charged) and clean (if not, RM20 is taken from the deposit).">
          Sebelum bertolak, periksa kenderaan bersama syarikat dan <B>rekod (gambar atau video)</B>{' '}
          sebarang kerosakan sedia ada, paras minyak dan bacaan odometer. Kerosakan baharu yang
          tidak direkod semasa serahan dianggap berlaku dalam tempoh sewa. Pulangkan kenderaan
          dengan <B>paras minyak yang sama</B> (jika kurang, kos minyak untuk mengisi semula
          dikenakan) dan dalam keadaan <B>bersih</B> (jika tidak, <Y>RM20</Y> ditolak daripada
          deposit).
        </Clause>
        <Clause en="The renter pays fuel, tolls (including tolls taken from a Touch 'n Go card or RFID linked to the vehicle), parking and every summons from the rental, including summonses that arrive after the vehicle is returned or the deposit is refunded. The company may give the renter's details to the police (PDRM), JPJ, local councils or toll operators to transfer a summons or charge to the renter.">
          Penyewa menanggung <B>minyak, tol</B> (termasuk tol yang ditolak daripada kad Touch
          &apos;n Go atau RFID kenderaan), <B>parking dan semua saman</B> dalam tempoh sewa,
          termasuk saman yang diterima{' '}
          <B>selepas kenderaan dipulangkan atau deposit dikembalikan</B>. Syarikat boleh memberi
          butiran penyewa kepada PDRM, JPJ, pihak berkuasa tempatan atau syarikat tol untuk
          memindahkan saman atau caj kepada penyewa.
        </Clause>
        <Clause en="Late return is charged RM10 an hour for vehicles under 1300cc, RM15 an hour for 1300cc to 1699cc, and RM20 an hour for 1700cc and above. More than 5 hours late is charged as a full extra day. If the vehicle is not returned and the renter cannot be reached for more than 24 hours after the return time, the company may take the vehicle back and make a police report.">
          Lewat memulangkan kenderaan dikenakan caj <Y>RM10 sejam</Y> bagi kenderaan bawah 1300cc,{' '}
          <Y>RM15 sejam</Y> bagi 1300cc hingga 1699cc, dan <Y>RM20 sejam</Y> bagi 1700cc ke atas.
          Lewat <B>lebih 5 jam</B> dikira sewa sehari penuh. Jika kenderaan tidak dipulangkan dan
          penyewa tidak dapat dihubungi lebih 24 jam selepas masa pemulangan, syarikat boleh
          mengambil semula kenderaan dan membuat laporan polis.
        </Clause>
        <Clause en="Vehicles may be fitted with GPS for security. The vehicle's location may be tracked during the rental and used for security, getting the vehicle back, and looking into accidents or summonses (see the Privacy Policy).">
          Kenderaan mungkin dipasang <B>GPS</B> untuk keselamatan. Lokasi kenderaan boleh dipantau
          sepanjang tempoh sewa dan digunakan untuk keselamatan, mendapatkan semula kenderaan, dan
          menyiasat kemalangan atau saman (lihat Dasar Privasi).
        </Clause>
      </Part>

      <div className="glass-card mb-6">
        <h2 className="text-lg font-semibold text-white">B. KEROSAKAN & KEMALANGAN</h2>
        <p className="text-xs text-slate-500 mb-4">Damage and accidents</p>
        <ol
          className="list-decimal pl-5 space-y-3 text-sm text-slate-300 leading-relaxed"
          start={9}
        >
          <Clause en="The renter is responsible for loss of or damage to the vehicle and its equipment during the rental, whatever the cause (collision, fire, flood, vandalism, theft and so on), except a fault or defect of the vehicle itself.">
            Penyewa <B>bertanggungjawab</B> atas kehilangan atau kerosakan pada kenderaan dan
            peralatannya sepanjang tempoh sewa, walau apa pun puncanya (perlanggaran, kebakaran,
            banjir, vandalisme, kecurian dan sebagainya), <B>kecuali</B> kerosakan atau kecacatan
            kenderaan itu sendiri.
          </Clause>
          <Clause en="For each incident the renter pays the actual cost (repairs insurance does not pay, the insurance excess, the lost no-claim discount, and the rent lost while the vehicle is in the workshop), up to the maximum in the table below for the vehicle's engine size and how long it is in the workshop. The amount is due straight away and may be taken from the deposit.">
            Bagi setiap kejadian, penyewa membayar <B>kos sebenar</B> (pembaikan yang tidak dibayar
            insurans, lebihan (excess) insurans, diskaun tanpa tuntutan (NCD) yang hilang, dan sewa
            yang hilang semasa kenderaan di bengkel), <B>sehingga had maksimum</B> dalam jadual di
            bawah mengikut cc kenderaan dan tempoh di bengkel. Bayaran perlu dibuat serta-merta dan
            boleh ditolak daripada deposit.
          </Clause>
        </ol>

        <LiabilityTable
          headers={['CC Kenderaan', 'Bengkel 1–7 hari', 'Bengkel lebih 7 hari', 'Kerosakan kecil']}
        />
        <p className="text-xs text-slate-500 mt-2">
          Had maksimum setiap kejadian. Kerosakan kecil: dibaiki tanpa kenderaan bermalam di bengkel
          (cth. calar, cermin sisi). / Maximum per incident. Minor damage: repaired without the
          vehicle staying overnight in the workshop (e.g. scratches, a side mirror).
        </p>

        <ol
          className="list-decimal pl-5 space-y-3 text-sm text-slate-300 leading-relaxed mt-4"
          start={11}
        >
          <Clause en="If the vehicle is stolen or written off, the renter pays the 'workshop more than 7 days' amount for its engine size, provided a police report was made within 24 hours and all keys are returned.">
            Jika kenderaan <B>dicuri atau hapus kira</B> (total loss), penyewa membayar amaun
            &quot;Bengkel lebih 7 hari&quot; bagi cc kenderaan, dengan syarat laporan polis dibuat
            dalam 24 jam dan semua kunci dipulangkan.
          </Clause>
          <Clause en="The table's limits do not apply, and the renter pays the full cost insurance does not pay, if: the driver was not approved or had no valid licence or GDL; the driver was under the influence of alcohol or drugs; the vehicle was used as forbidden in clause 3 or outside the area in clause 4; the keys were left in the vehicle or it was left unlocked; no police report was made within 24 hours; or insurance refuses the claim because of the renter's fault.">
            Had dalam jadual <B>tidak terpakai</B>, dan penyewa menanggung <B>kos penuh</B> yang
            tidak dibayar insurans, jika: pemandu tidak diluluskan atau tiada lesen atau GDL yang
            sah; pemandu di bawah pengaruh alkohol atau dadah; kenderaan digunakan seperti yang
            dilarang dalam klausa 3 atau di luar kawasan dalam klausa 4; kunci ditinggalkan dalam
            kenderaan atau kenderaan tidak dikunci; laporan polis tidak dibuat dalam 24 jam; atau
            insurans menolak tuntutan kerana kesalahan penyewa.
          </Clause>
          <Clause en="After an accident: (a) tell the company straight away; (b) make a police report within 24 hours, as the law requires; (c) take photos of the vehicles, the place and the other party's details; (d) do not admit fault or settle with the other party; (e) do not repair or tow the vehicle without the company's permission.">
            Jika berlaku <B>kemalangan</B>: (a) maklumkan syarikat dengan segera; (b) buat{' '}
            <B>laporan polis dalam 24 jam</B>, seperti yang diwajibkan undang-undang; (c) ambil
            gambar kenderaan, tempat kejadian dan butiran pihak lain; (d) jangan mengaku salah atau
            berunding dengan pihak lain; (e) jangan baiki atau tunda kenderaan tanpa kebenaran
            syarikat.
          </Clause>
        </ol>
      </div>

      <Part title="C. KEROSAKAN KENDERAAN SENDIRI" titleEn="Breakdowns" start={14}>
        <Clause en="If the vehicle breaks down through its own fault, not the renter's, the company replaces it with another vehicle when one is available. If none is, the affected days are not charged: refunded, or given free on a monthly rental. Do not repair it yourself without the company's permission; approved repair costs are paid back or taken off the rent, with the receipt.">
          Jika kenderaan rosak kerana <B>kenderaan itu sendiri</B> (bukan disebabkan penyewa),
          syarikat akan <B>menggantikannya</B> dengan kenderaan lain jika ada. Jika tiada, sewa bagi
          hari yang terjejas <B>tidak dikenakan</B>: dikembalikan, atau diberi percuma bagi sewa
          bulanan. Jangan baiki sendiri tanpa kebenaran syarikat; kos pembaikan yang diluluskan
          dibayar balik atau ditolak daripada sewa, dengan resit.
        </Clause>
        <Clause en="If a warning light comes on or something seems wrong, stop safely and call the company. Damage from carrying on driving after a warning is the renter's.">
          Jika lampu amaran menyala atau ada masalah, berhenti dengan selamat dan hubungi syarikat.
          Kerosakan akibat terus memandu selepas amaran ditanggung penyewa.
        </Clause>
      </Part>

      <Part title="D. SEWA BULANAN" titleEn="Monthly rentals" start={16}>
        <Clause en="Monthly rent is paid in advance each month on the agreed date. If it is more than 7 days late, the company may take the vehicle back and take what is owed from the deposit. Routine servicing is paid by the company; bring the vehicle in for service when asked.">
          Sewa bulanan dibayar <B>terlebih dahulu setiap bulan</B> pada tarikh yang dipersetujui.
          Jika lewat <B>lebih 7 hari</B>, syarikat boleh mengambil semula kenderaan dan menolak
          jumlah tertunggak daripada deposit. Servis berkala ditanggung syarikat; penyewa hendaklah
          membawa kenderaan untuk servis apabila diminta.
        </Clause>
      </Part>

      <Part title="E. DEPOSIT & PEMBATALAN" titleEn="Deposit and cancellation" start={17}>
        <Clause en="The deposit is refunded within 7 working days after the vehicle is returned (or kept as credit for the next rental if the renter prefers), less any charges under this agreement. If the cost of damage is not yet known, the deposit may be held until it is.">
          Deposit <B>dikembalikan dalam tempoh 7 hari bekerja</B> selepas kenderaan dipulangkan
          (atau disimpan sebagai kredit untuk sewaan seterusnya jika penyewa mahu), selepas ditolak
          sebarang caj di bawah perjanjian ini. Jika kos kerosakan belum diketahui, deposit boleh
          ditahan sehingga kos pembaikan diketahui.
        </Clause>
        <Clause en="If the renter cancels or shortens the rental, a penalty of 25% of the rent for the unused days applies, and the rest of that rent is refunded (or kept as credit). Cancelling before pick-up: 25% of the rental total.">
          Jika penyewa <B>membatalkan atau memendekkan</B> sewa, penalti <Y>25%</Y> daripada sewa
          bagi <B>hari yang tidak digunakan</B> dikenakan, dan baki sewa hari tersebut dikembalikan
          (atau disimpan sebagai kredit). Membatalkan sebelum mengambil kenderaan: 25% daripada
          jumlah sewa.
        </Clause>
        <Clause en="If the company cancels or cannot provide the vehicle, everything paid is refunded in full, or another vehicle is provided if the renter agrees.">
          Jika <B>syarikat</B> membatalkan atau tidak dapat menyediakan kenderaan, semua bayaran{' '}
          <B>dikembalikan sepenuhnya</B>, atau kenderaan lain disediakan jika penyewa bersetuju.
        </Clause>
      </Part>
    </>
  );
}

// ---------------------------------------------------------------------------
// Version 1, until 16 Nov 2026 (as signed; do not change)
// ---------------------------------------------------------------------------

function TermsV1() {
  return (
    <>
      <div className="glass-card mb-6">
        <h2 className="text-lg font-semibold text-white mb-4">
          TERMA & SYARAT (Terms & Conditions)
        </h2>
        <div className="text-sm text-slate-300 space-y-3 leading-relaxed">
          <p className="text-xs text-slate-500 italic mb-4">
            Penyewa yang mengikat kontrak sewa kenderaan bulanan, jika berlaku kerosakan sewaktu
            tempoh sewa yang disebabkan oleh kenderaan itu sendiri, syarikat akan menggantikan
            kenderaan tersebut dengan yang lain. Jika ada, jika tiada kenderaan lain, syarikat akan
            beri sewa percuma mengikut hari yang terlibat.
          </p>

          <ol className="list-decimal pl-5 space-y-2">
            <li>
              Penyewa bersetuju untuk menyewa dan memulangkan kenderaan pada{' '}
              <strong className="text-white">tarikh dan masa yang telah ditetapkan</strong>.
            </li>
            <li>
              Penyewa mestilah mempunyai{' '}
              <strong className="text-white">lesen memandu Malaysia Kelas D</strong> yang sah. Bagi
              kenderaan perdagangan (van panel), penyewa juga mestilah mempunyai{' '}
              <strong className="text-white">GDL Kelas D</strong> yang sah sepanjang tempoh sewa.
            </li>
            <li>
              Penyewa mestilah memaklumkan kepada syarikat sekiranya berlaku sebarang perkara yang
              tidak diingini. Contoh:{' '}
              <strong className="text-white">kemalangan, kehilangan dan sebagainya</strong>.
            </li>
            <li>
              Kenderaan mestilah digunakan untuk perkara yang{' '}
              <strong className="text-white">mematuhi undang-undang sahaja</strong>. Segala perkara
              yang melanggar undang-undang seperti pengedaran dadah, perlumbaan, perjudian dan
              sebagainya adalah <strong className="text-red-400">DILARANG</strong>.
            </li>
            <li>
              Penyewa adalah <strong className="text-white">bertanggungjawab</strong> dengan segala
              bentuk saman yang dikenakan, bayaran parking, minyak kenderaan, kerosakan atau
              kegagalan kenderaan yang berpunca dari penyewa sepanjang tempoh sewaan.
            </li>
            <li>
              Untuk sebarang <strong className="text-white">kelewatan pengembalian</strong>{' '}
              kenderaan, penyewa akan dikenakan caj sebanyak{' '}
              <strong className="text-yellow-400">RM10.00 / RM15.00 / RM20.00 sejam</strong>.
              Penyewa bertanggungjawab untuk memulangkan kenderaan dalam keadaan bersih. Jika tidak,
              deposit akan ditolak sebanyak <strong className="text-yellow-400">RM20</strong>.
            </li>
          </ol>
        </div>
      </div>

      <div className="glass-card mb-6">
        <h2 className="text-lg font-semibold text-white mb-4">INSURAN / PERSETUJUAN BERSAMA</h2>
        <div className="text-sm text-slate-300 space-y-3 leading-relaxed">
          <ol className="list-decimal pl-5 space-y-3">
            <li>
              Penyewa bersetuju untuk{' '}
              <strong className="text-white">bertanggungjawab sepenuhnya</strong> diatas segala
              kehilangan atau kerosakan pada kenderaan atau segala peralatan sepanjang tempoh sewaan
              mengikut terma dan syarat penyewaan kenderaan walaupun berpunca dari perlanggaraan,
              kebakaran, banjir, vandalisme, kecurian atau apapunpunca kecuali atas kerosakan atau
              kecacatan kenderaan itu sendiri.
            </li>
            <li>
              Penyewa <strong className="text-white">wajib membayar gantirugi</strong> kemalangan
              atau kerosakan kepada syarikat serta merta. Ganti rugi kemalangan yang dibayar oleh
              penyewa sama sekali tidak melibatkan tuntutan insuran kenderaan walaupun tuntutan
              insuran dibuat oleh syarikat.
            </li>
          </ol>

          <LiabilityTable
            headers={['CC Kenderaan', 'Bengkel < 7 Hari', 'Bengkel > 7 Hari', 'Kerosakan Kecil']}
          />

          <ol className="list-decimal pl-5 space-y-2" start={3}>
            <li>
              Deposit akan <strong className="text-white">dikembalikan semula</strong> kepada
              penyewa diantara <strong className="text-white">7 hari bekerja</strong>. Sekiranya
              tidak berlaku sebarang perkara yang tidak diingini mengikut terma & syarat perjanjian
              penyewaan.
            </li>
            <li>
              Penalti sebanyak <strong className="text-yellow-400">25%</strong> dari jumlah bayaran
              keseluruhan tempoh sewaan akan dikenakan sekiranya penyewa{' '}
              <strong className="text-white">membatalkan atau memendekkan</strong> perjanjian tempoh
              sewaan.
            </li>
          </ol>
        </div>
      </div>
    </>
  );
}
