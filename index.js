const fetch = require("node-fetch");

let settings = {
  myQuery: 'meat & bread',
  lucky: false,
  matchedDistance: '',
  matchedPrice: '',
};

const luckyOptions = [
  'lunch',
  'mexican',
  'thai',
  'vietnamese',
  'chinese',
  'mediterranean',
  'greek',
  'tacos',
  'wraps',
  'subs',
  'grilled cheese',
  'sandwiches',
  'sushi',
  'pizza',
  'ramen',
  'burgers',
  'bbq',
  'hot dogs',
  'poke',
  'curry',
  'noodles',
  'healthy food',
  'fast food',
];

const commonSpeech = [
  'i want', 'give me', 'show me', 'how about', 'where is', 'how about', 'something', 'tasty', 'very', 'super', 'extremely'
];

const priceValue = [
  {
    inputs: ['cheap', 'inexpensive'],
    output: '&maxprice=2'
  },
  {
    inputs: ['very cheap', 'super cheap', 'extremely cheap'],
    output: '&maxprice=1'
  },
  {
    inputs: ['expensive'],
    output: '&minprice=3'
  },
  {
    inputs: ['very expensive', 'extremely expensive', 'super expensive'],
    output: '&minprice=4'
  }
];

const distances = [
  {
    inputs: ['short walk', 'short walk to', 'nearby', 'near-by', 'near by', 'quick walk', 'quick walk to', 'close by'],
    output: '&radius=75'
  },
  {
    inputs: ['very short walk', 'very short walk to', 'very nearby', 'very near-by', 'very near by', 'very quick walk', 'very quick walk to', 'very close by'],
    output: '&radius=50'
  },
  {
    inputs: ['long distance', 'far away', 'a good walk', 'a good walk to', 'short drive'],
    output: '&radius=300'
  }
];

const distanceMatched = distance => {
  settings.matchedDistance = distance;
  return true
};

const priceMatched = price => {
  settings.matchedPrice = price;
  return true
};

const distIsInQuery = (q, distance) => {
  return q.includes(distance) ? distanceMatched(distance) : false;
};

const priceInQuery = (q, price) => {
  return q.includes(price) ? priceMatched(price) : false;
};

const checkDistance = q => {
  const d = distances.map(
    disType => {
      return disType.inputs.map(
        distance => {
          return distIsInQuery(q, distance)
        }
      ).filter(Boolean).length > 0 ? disType.output : null
    }).filter(Boolean);


  return d.length > 0 ?
    {distance: d[d.length-1], searchType: 'nearbysearch'} :
    {distance: "&radius=125", searchType: 'textsearch'};
};

const checkPrice = q => {
  const d = priceValue.map(
    priceType => {
      return priceType.inputs.map(
        price => {
          return priceInQuery(q, price)
        }
      ).filter(Boolean).length > 0 ? priceType.output : null
    }).filter(Boolean);

  return d.length > 0 ?
    {urlPrice: d[d.length-1]} :
    {urlPrice: "&maxprice=2"};
};

const strippedUrl = url => {
  let newUrl = url;
  if(settings.matchedDistance !== '') newUrl = newUrl.replace(settings.matchedDistance, '').trim();
  if(settings.matchedPrice !== '') newUrl = newUrl.replace(settings.matchedPrice, '').trim();
  commonSpeech.forEach(e=>newUrl = newUrl.replace(e,''));
  return encodeURI(newUrl);
};

const getStars = rating => {
  const roundedRating = Math.round(rating*2)/2;
  const wholeStars = Math.floor(roundedRating);
  const halfStar = Number.isInteger(roundedRating) ? 1 : 0;
  const emptyStar = 5 - wholeStars - halfStar;
  const stars = [];
  for (let i = 0; i < wholeStars; i++) { stars.push(':full_moon_with_face:') }
  for (let i = 0; i < halfStar; i++) { stars.push(':last_quarter_moon_with_face:') }
  for (let i = 0; i < emptyStar; i++) { stars.push('') }
  return stars.join(' ');
};

const getRandomPicks = (pickAmount, choices) => {
  let randomPicks = [];

  while(randomPicks.length < pickAmount){
    const r = Math.floor(Math.random()*choices.length);
    if(randomPicks.indexOf(r) === -1) randomPicks.push(r);
  }

  return randomPicks;
};

const formatRestaurant = (choices, pick) => ({
  title: choices[pick].name,
  title_link: formatWalkingDirections(choices[pick]),
  text: `Rating: ${getStars(choices[pick].rating)}`
});

const formatResponse = choices => {

  if(choices.length === 0) return 'Little bit picky are we? Nothing found.';
  const pickAmount = choices.length > 5 ? 5 : choices.length;

  return {
    text: `What about ${settings.lucky && settings.lucky !== 'lunch' ? settings.lucky : 'these'}:`,
    attachments: getRandomPicks(pickAmount, choices).map(pick => formatRestaurant(choices, pick))
  }
};

const formatWalkingDirections = ({geometry: {location: {lat,lng}}, place_id}) =>
  [
    `https://www.google.com/maps/dir/`,
    `?api=1`,
    `&origin=49.281344,-123.114522`,
    `&destination=${lat},${lng}`,
    `&destination_place_id=${place_id}`,
    `&travelmode=walking`
  ].join('');

const feelingLucky = () => {
  const luckyPick = luckyOptions[Math.floor(Math.random() * luckyOptions.length)];
  settings.lucky = luckyPick;
  return luckyPick;
};

exports.getPlace = (req, res) => {

  const request = req ?
    req.body && req.body.text ? req.body.text.toLowerCase() : ''
      : settings.myQuery ? settings.myQuery.toLocaleLowerCase() : '';

  request === '' ? settings.lucky = true : settings.lucky = false;

  let {distance, searchType} = checkDistance(request);
  let { urlPrice } = checkPrice(request);

  const encodedRequest = strippedUrl(request);
  searchType = request === '' ? 'nearbysearch' : searchType;

  const search = `&${searchType === 'nearbysearch' ? 'keyword' : 'query'}=${encodedRequest === '' ? feelingLucky() : encodedRequest}`;

  const {url} = {url: `https://maps.googleapis.com/maps/api/place/${searchType}/json` +
    "?location=49.281344,-123.114522" +
    search +
    distance +
    urlPrice +
    "&rankby=prominence" +
    `&key=${process.env.GOOGAPI}`
  };

  console.log({url, encodedRequest, request});

  fetch(url).then(e => e.json()).then(({ results }) =>
    res ? returnRequest(results) : logRequest(results));

  const returnRequest = results =>
    res.status(200).send(JSON.stringify(formatResponse(results)));

  const logRequest = results => {
    console.log(results);
    console.log(formatResponse(results));
    debugger;
  };

};
