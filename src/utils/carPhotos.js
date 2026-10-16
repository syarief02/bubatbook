// Credits for car photos taken from Wikimedia Commons. Their licences require
// the author, the licence and the changes to be shown with the photo; the car
// page does that for any image_url listed here. The edited files are shared
// under the same licence.
export const PHOTO_CREDITS = {
  '/cars/perodua-alza-black.jpg': {
    author: 'Aaront1059',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    source: 'https://commons.wikimedia.org/wiki/File:Perodua_Alza_1.5_X_(Elegant_Black).jpg',
    changes: 'cropped, number plate blurred',
  },
  '/cars/ford-ranger-2019-blue.jpg': {
    author: 'RL GNZLZ',
    license: 'CC BY-SA 2.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/2.0/',
    source: 'https://commons.wikimedia.org/wiki/File:Ford_Ranger_XLT_2.5_2019.jpg',
    changes: 'colour changed from red to blue, number plate blurred',
  },
  '/cars/nissan-vanette.jpg': {
    author: 'Two hundred percent',
    license: 'CC BY-SA 3.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
    source:
      'https://commons.wikimedia.org/wiki/File:Nissan_Vanette_(second_generation,_third_facelift)_(front),_Kuala_Lumpur.jpg',
    changes: 'resized',
  },
};

// The owner's own photos of a vehicle, by plate number, shown as a gallery on
// the car page. The first one is also the car's main picture (image_url).
// Location data (GPS) is removed from phone photos before they are added.
export const CAR_GALLERIES = {
  'VJC 5290': [
    '/cars/vjc5290/1.jpg',
    '/cars/vjc5290/2.jpg',
    '/cars/vjc5290/3.jpg',
    '/cars/vjc5290/4.jpg',
    '/cars/vjc5290/5.jpg',
    '/cars/vjc5290/6.jpg',
    '/cars/vjc5290/7.jpg',
    '/cars/vjc5290/8.jpg',
  ],
  'VQB 5567': [
    '/cars/vqb5567/1.jpg',
    '/cars/vqb5567/2.jpg',
    '/cars/vqb5567/3.jpg',
    '/cars/vqb5567/4.jpg',
    '/cars/vqb5567/5.jpg',
    '/cars/vqb5567/6.jpg',
    '/cars/vqb5567/7.jpg',
  ],
};
