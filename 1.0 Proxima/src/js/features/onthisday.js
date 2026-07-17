const EVENTS = {
  "01-01": [
    { y: 1801, t: "Italian astronomer Giuseppe Piazzi discovers Ceres, which was originally called a planet and is now classified as a dwarf planet." }
  ],
  "01-02": [
    { y: 1959, t: "The Soviet Union launches Luna 1, the first spacecraft to escape Earth's gravity and fly near the Moon." }
  ],
  "01-04": [
    { y: 2004, t: "NASA's Spirit rover touches down on Mars to begin its hunt for clues of past water." }
  ],
  "01-08": [
    { y: 1942, t: "Renowned theoretical physicist Stephen Hawking is born in Oxford, England." }
  ],
  "01-10": [
    { y: 1968, t: "Surveyor 7 lands on the Moon, completing NASA's robotic lunar landing program to prepare for human missions." }
  ],
  "01-14": [
    { y: 2005, t: "The Huygens probe touches down on Saturn's orange moon Titan, sending back the first photos from a world in the outer solar system." }
  ],
  "01-15": [
    { y: 2006, t: "NASA's Stardust spacecraft returns safely to Earth with the first dust samples ever collected from a comet." }
  ],
  "01-27": [
    { y: 1967, t: "The United States, the Soviet Union, and the United Kingdom sign the Outer Space Treaty, declaring space a peaceful territory for all humanity." }
  ],
  "01-28": [
    { y: 1986, t: "The Space Shuttle Challenger is lost shortly after launch, a tragic moment that unites the world in grief for its seven brave crew members." }
  ],
  "01-31": [
    { y: 1958, t: "Explorer 1, the first satellite launched by the United States, reaches Earth orbit and discovers the intense radiation belts surrounding our planet." },
    { y: 1971, t: "Apollo 14 launches on a mission to the Moon, carrying veteran astronaut Alan Shepard back into space." }
  ],
  "02-01": [
    { y: 2003, t: "The Space Shuttle Columbia is lost during reentry over Texas, deeply saddening the global space community." }
  ],
  "02-03": [
    { y: 1966, t: "The Soviet probe Luna 9 makes the first survivable landing on the Moon, proving that the lunar surface is solid enough to support spacecraft." }
  ],
  "02-07": [
    { y: 1984, t: "Astronaut Bruce McCandless takes a leap of faith to perform the first ever untethered spacewalk using a nitrogen jetpack." }
  ],
  "02-11": [
    { y: 2016, t: "Scientists officially announce the first direct detection of gravitational waves, proving a major prediction of Einstein's theory of general relativity." }
  ],
  "02-14": [
    { y: 1990, t: "Voyager 1 points its camera backward to capture the famous Pale Blue Dot portrait of Earth from six billion kilometers away." },
    { y: 2001, t: "The NEAR Shoemaker spacecraft makes a historic landing on the surface of the asteroid Eros." }
  ],
  "02-15": [
    { y: 2013, t: "A massive meteor explodes over the Russian city of Chelyabinsk, serving as a vivid reminder of the cosmic debris in our solar system." }
  ],
  "02-18": [
    { y: 1930, t: "Clyde Tombaugh spots Pluto, which was then celebrated as the ninth planet in our solar system." },
    { y: 2021, t: "NASA's Perseverance rover lands safely in Jezero Crater to search for signs of ancient life on Mars." }
  ],
  "02-20": [
    { y: 1962, t: "John Glenn climbs into space aboard Friendship 7, becoming the first American to circle the globe." },
    { y: 1986, t: "The Soviet Union launches the core module of the Mir space station, starting a new era of long term human spaceflight." }
  ],
  "02-24": [
    { y: 1968, t: "Jocelyn Bell Burnell publishes her discovery of pulsars, which are rapidly spinning neutron stars that emit regular radio pulses." }
  ],
  "03-01": [
    { y: 1966, t: "The Venera 3 probe crashes on Venus, making it the first human spacecraft to reach the surface of another planet." }
  ],
  "03-02": [
    { y: 1972, t: "Pioneer 10 launches toward Jupiter as the first human spacecraft sent to explore the outer solar system." }
  ],
  "03-05": [
    { y: 1979, t: "Voyager 1 makes its closest pass to Jupiter, capturing stunning, detailed images of its turbulent clouds and moons." }
  ],
  "03-06": [
    { y: 2009, t: "NASA launches the Kepler space telescope, beginning a historic mission to hunt for Earth like planets orbiting other stars." }
  ],
  "03-13": [
    { y: 1781, t: "William Herschel spots Uranus, expanding the known boundaries of our solar system for the first time in modern history." },
    { y: 1930, t: "The discovery of Pluto is officially announced to the world by the Lowell Observatory." }
  ],
  "03-14": [
    { y: 1879, t: "Physicist Albert Einstein is born in Germany, destined to rewrite our understanding of space, time, and gravity." },
    { y: 2018, t: "Renowned theoretical physicist Stephen Hawking passes away, leaving behind a legacy of pioneering research on black holes." }
  ],
  "03-16": [
    { y: 1926, t: "Robert Goddard launches the world's first liquid fuel rocket in Auburn, Massachusetts, paving the way for modern spaceflight." }
  ],
  "03-18": [
    { y: 1965, t: "Soviet cosmonaut Alexei Leonov steps outside his spacecraft to perform the first spacewalk in human history." }
  ],
  "04-03": [
    { y: 1966, t: "The Soviet probe Luna 10 enters lunar orbit, becoming the first artificial satellite of the Moon." }
  ],
  "04-11": [
    { y: 1970, t: "Apollo 13 launches toward the Moon, beginning a mission that would soon turn into one of history's greatest rescue operations." }
  ],
  "04-12": [
    { y: 1961, t: "Soviet cosmonaut Yuri Gagarin boards Vostok 1 and becomes the first human to travel into outer space." },
    { y: 1981, t: "NASA launches the Space Shuttle Columbia on its maiden voyage, beginning a new era of reusable spacecraft." }
  ],
  "04-13": [
    { y: 1970, t: "An oxygen tank explodes on Apollo 13, forcing the crew to abandon their Moon landing plans and fight for survival." }
  ],
  "04-17": [
    { y: 1970, t: "The crew of Apollo 13 returns safely to Earth after a harrowing journey, splashing down in the Pacific Ocean." }
  ],
  "04-24": [
    { y: 1990, t: "The Hubble Space Telescope is carried into orbit by the Space Shuttle Discovery, ready to change how we see the universe." }
  ],
  "04-28": [
    { y: 2001, t: "American businessman Dennis Tito launches to the International Space Station, becoming the world's first private space tourist." }
  ],
  "05-05": [
    { y: 1961, t: "Alan Shepard launches aboard Freedom 7, becoming the first American to reach space." }
  ],
  "05-14": [
    { y: 1973, t: "Skylab, the first American space station, launches into Earth orbit to study our planet and the Sun." }
  ],
  "05-25": [
    { y: 1961, t: "President John F. Kennedy addresses Congress and commits the United States to landing a man on the Moon before the decade is out." },
    { y: 2008, t: "NASA's Phoenix spacecraft lands near the Martian north pole to study the history of water on the Red Planet." }
  ],
  "05-28": [
    { y: 1959, t: "The United States successfully launches the first primates into space, Able and Baker, who both return unharmed from their suborbital flight." },
    { y: 2011, t: "Astronauts complete the final spacewalk of the Space Shuttle era, marking the formal completion of the US segment of the International Space Station." }
  ],
  "05-30": [
    { y: 1971, t: "NASA launches Mariner 9 on a mission to become the first spacecraft to successfully orbit another planet." }
  ],
  "06-02": [
    { y: 1966, t: "The United States achieves its first soft landing on the Moon with the robotic lunar lander Surveyor 1." }
  ],
  "06-03": [
    { y: 1965, t: "Astronaut Ed White steps out of his Gemini 4 capsule, becoming the first American to walk in space." }
  ],
  "06-16": [
    { y: 1963, t: "Soviet cosmonaut Valentina Tereshkova launches aboard Vostok 6, making history as the first woman in space." }
  ],
  "06-18": [
    { y: 1983, t: "Sally Ride launches aboard the Space Shuttle Challenger, becoming the first American woman in space." }
  ],
  "06-21": [
    { y: 2004, t: "SpaceShipOne reaches space, completing the first privately funded human spaceflight in history." }
  ],
  "06-22": [
    { y: 1978, t: "Astronomer James Christy discovers Pluto's largest moon, Charon, at the United States Naval Observatory." }
  ],
  "06-30": [
    { y: 1908, t: "A massive explosion, likely from an exploding asteroid or comet, flattens millions of trees in a remote Siberian forest during the Tunguska event." }
  ],
  "07-04": [
    { y: 1054, t: "Chinese astronomers record the sudden appearance of a guest star, which we now know was the supernova that created the Crab Nebula." },
    { y: 1997, t: "Mars Pathfinder touches down on the Red Planet, releasing the tiny Sojourner rover to explore the Martian terrain." },
    { y: 2005, t: "NASA's Deep Impact spacecraft releases an impactor that deliberately collides with comet Tempel 1 to study its composition." }
  ],
  "07-14": [
    { y: 1965, t: "Mariner 4 flies past Mars, sending back the first close up photos of another planet's cratered surface." },
    { y: 2015, t: "The New Horizons spacecraft flies past Pluto, sending back the first close up images of its icy heart shaped plains." }
  ],
  "07-16": [
    { y: 1969, t: "The Saturn V rocket roars to life as Apollo 11 launches from Florida on its historic journey to land humans on the Moon." },
    { y: 1994, t: "Fragments of Comet Shoemaker Levy 9 begin crashing into Jupiter, offering a spectacular show of cosmic collisions." }
  ],
  "07-20": [
    { y: 1969, t: "Astronauts Neil Armstrong and Buzz Aldrin step onto the lunar surface, marking the first time humans walk on another world." },
    { y: 1976, t: "NASA's Viking 1 lander makes a safe arrival on Mars, sending back the very first clear photos from the Martian surface." }
  ],
  "07-23": [
    { y: 1999, t: "The Chandra X-ray Observatory is deployed into orbit to capture images of the universe's most violent and high energy regions." }
  ],
  "07-29": [
    { y: 1958, t: "President Dwight D. Eisenhower signs the law that officially establishes NASA, beginning America's organized quest for the stars." }
  ],
  "08-05": [
    { y: 1930, t: "Astronaut Neil Armstrong, the first person to walk on the Moon, is born in Wapakoneta, Ohio." },
    { y: 2011, t: "NASA launches the Juno spacecraft on a five year journey to study the deep interior of Jupiter." }
  ],
  "08-06": [
    { y: 2012, t: "The Curiosity rover touches down in Gale Crater to begin investigating whether Mars ever had environments capable of supporting microbial life." }
  ],
  "08-12": [
    { y: 1960, t: "NASA launches Echo 1, a giant metallic balloon that acts as the world's first passive communications satellite." },
    { y: 2018, t: "The Parker Solar Probe launches on a historic mission to dive through the outer atmosphere of the Sun." }
  ],
  "08-20": [
    { y: 1975, t: "NASA launches Viking 2, a mission designed to place a spacecraft in orbit and land a science station on Mars." },
    { y: 1977, t: "Voyager 2 begins its journey from Earth, setting off on a grand tour of the outer planets." }
  ],
  "08-24": [
    { y: 2006, t: "The International Astronomical Union votes to reclassify Pluto as a dwarf planet, sparking worldwide debate." }
  ],
  "08-25": [
    { y: 1989, t: "Voyager 2 passes close to Neptune, giving humanity its first and only close look at the blue ice giant." },
    { y: 2012, t: "Voyager 1 officially crosses the boundary of our solar system, becoming the first human object to enter interstellar space." }
  ],
  "09-01": [
    { y: 1979, t: "Pioneer 11 flies past Saturn, capturing the first ever close up views of the ringed giant and its moons." }
  ],
  "09-05": [
    { y: 1977, t: "Voyager 1 launches on a trajectory to the outer planets, carrying a golden record of Earth's sounds and images for any alien civilizations." }
  ],
  "09-12": [
    { y: 1962, t: "President John F. Kennedy delivers his famous speech at Rice University, declaring that America chooses to go to the Moon." },
    { y: 1970, t: "The Soviet Union launches Luna 16, which will become the first robotic probe to land on the Moon and return soil samples to Earth." }
  ],
  "09-14": [
    { y: 1959, t: "The Soviet Union's Luna 2 probe crashes into the Moon, becoming the first human object to ever reach another world." },
    { y: 2015, t: "The LIGO observatories detect gravitational waves for the first time, confirming Albert Einstein's century old prediction about ripples in spacetime." }
  ],
  "09-15": [
    { y: 2017, t: "The Cassini spacecraft intentionally plunges into Saturn's atmosphere, ending its historic thirteen year exploration of the ringed planet." }
  ],
  "09-23": [
    { y: 1846, t: "German astronomer Johann Gottfried Galle discovers Neptune, confirming mathematical predictions that an eighth planet existed." }
  ],
  "09-28": [
    { y: 2008, t: "SpaceX successfully launches Falcon 1 into orbit, becoming the first private company to launch a liquid fuel rocket into space." }
  ],
  "10-04": [
    { y: 1957, t: "The Soviet Union launches Sputnik 1 into orbit, starting the space age and catching the world by surprise." }
  ],
  "10-11": [
    { y: 1968, t: "Apollo 7 launches into Earth orbit, marking the first crewed flight of the Apollo spacecraft." }
  ],
  "10-15": [
    { y: 1997, t: "The Cassini spacecraft launches on its long journey to Saturn, carrying the European Space Agency's Huygens probe." },
    { y: 2003, t: "Yang Liwei launches aboard Shenzhou 5, making history as China's first person in space." }
  ],
  "10-18": [
    { y: 1967, t: "The Soviet Union's Venera 4 probe enters the atmosphere of Venus, sending back the first direct measurements of another planet's environment." }
  ],
  "10-22": [
    { y: 1975, t: "The Soviet Venera 9 probe touches down on Venus, braving intense heat and pressure to send back the first photograph ever taken from the surface of another planet." }
  ],
  "10-29": [
    { y: 1991, t: "The Galileo spacecraft flies past the asteroid Gaspra, capturing the first close up images of an asteroid in space." }
  ],
  "11-03": [
    { y: 1957, t: "The Soviet Union launches Sputnik 2 carrying Laika, a stray dog who became the first living creature to orbit Earth." }
  ],
  "11-09": [
    { y: 1934, t: "Astronomer and science communicator Carl Sagan is born, inspiring generations to look up at the cosmos." }
  ],
  "11-12": [
    { y: 2014, t: "The Rosetta mission's Philae lander makes the first soft landing on a comet's nucleus, touching down on Comet 67P." }
  ],
  "11-15": [
    { y: 1988, t: "The Soviet space shuttle Buran completes its first and only uncrewed flight, orbiting the Earth twice before landing safely." }
  ],
  "11-16": [
    { y: 1974, t: "Astronomers use the Arecibo radio telescope to beam a message of greeting from humanity toward the globular cluster M13." },
    { y: 2022, t: "NASA launches the Artemis 1 mission, sending an uncrewed Orion spacecraft to the Moon and back to pave the way for human return." }
  ],
  "11-17": [
    { y: 1970, t: "The Soviet Union's Lunokhod 1 lands on the Moon, becoming the first robotic rover to explore another world." }
  ],
  "11-20": [
    { y: 1998, t: "The Russian Zarya module is launched into orbit, laying down the very first piece of the International Space Station." }
  ],
  "11-26": [
    { y: 2011, t: "NASA launches the massive Curiosity rover on a mission to explore Gale Crater on Mars." }
  ],
  "12-07": [
    { y: 1972, t: "Apollo 17 launches on the final crewed mission to the Moon under the Apollo program." },
    { y: 1995, t: "NASA's Galileo spacecraft arrives at Jupiter, beginning an eight year orbit to study the giant planet and its moons." }
  ],
  "12-14": [
    { y: 1962, t: "Mariner 2 flies past Venus, completing the first successful planetary flyby by any spacecraft." },
    { y: 1972, t: "Astronaut Eugene Cernan climbs back into the lunar lander, becoming the last human to walk on the Moon." }
  ],
  "12-15": [
    { y: 1970, t: "The Soviet Union's Venera 7 lands on Venus, becoming the first spacecraft to successfully transmit data from the blistering surface of another planet." }
  ],
  "12-21": [
    { y: 1968, t: "Apollo 8 launches from Earth, sending three astronauts on the first human flight to orbit the Moon." }
  ],
  "12-24": [
    { y: 1968, t: "The crew of Apollo 8 broadcasts a reading from Genesis while orbiting the Moon on Christmas Eve, offering a peaceful message to Earth." }
  ],
  "12-25": [
    { y: 1642, t: "Great thinker Isaac Newton is born in England, eventually laying down the laws of motion and universal gravity." },
    { y: 2021, t: "The James Webb Space Telescope launches into space, destined to peer back to the dawn of the universe." }
  ]
};

export function onThisDay(date = new Date()) {
  const mmdd = `${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const list = EVENTS[mmdd] || [];
  return list.map((e) => ({ year: e.y, text: e.t, mmdd }));
}