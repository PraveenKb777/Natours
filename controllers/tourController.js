const Tour = require('../modals/tourModal');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');

const factory = require('./handlerFactory');

exports.aliasTopTours = (req, res, next) => {
  // Limit query results to 5
  req.query.limit = 5;

  // Sort by ratings average in descending order and price
  req.query.sort = '-ratingsAverage,price';

  // Define fields to return in query results
  req.query.fields = 'name,price,difficulty,summary,ratingsAverage';

  next();
};

exports.updateTour = factory.updateOne(Tour);
exports.deleteTour = factory.deleteOne(Tour);
// middleware for checking reviews before deleting a tour
exports.getTourStats = catchAsync(async (req, res, next) => {
  const stats = await Tour.aggregate([
    {
      $match: { ratingsAverage: { $gte: 4.5 } }
    },
    {
      $group: {
        _id: { $toUpper: '$difficulty' },
        num: { $sum: 1 },
        numRatings: { $sum: '$ratingsQuantity' },
        avgRating: { $avg: '$ratingsAverage' },
        avgPrice: { $avg: '$price' },
        minPrice: { $min: '$price' },
        maxPrice: { $max: '$price' }
      }
    },
    {
      $sort: { avgPrice: -1 }
    },
    {
      $match: {
        _id: { $ne: 'EASY' }
      }
    }
  ]);
  return res.status(200).json({
    status: 'success',
    data: stats
  });
});

exports.getMonthlyplan = catchAsync(async (req, res, next) => {
  const year = req.params.year * 1;
  const plan = await Tour.aggregate([
    {
      $unwind: '$startDates'
    },
    {
      $match: {
        startDates: {
          $gte: new Date(`${year}-01-01`),
          $lte: new Date(`${year}-12-31`)
        }
      }
    },
    {
      $group: {
        _id: {
          $month: '$startDates'
        },
        numOfToursStarts: { $sum: 1 },
        tours: {
          $push: '$name'
        }
      }
    },
    {
      $addFields: { month: '$_id' }
    },
    {
      $project: { _id: 0 }
    },
    {
      $sort: {
        numOfToursStarts: -1
      }
    },
    {
      $limit: 3
    }
  ]);
  return res.status(200).json({
    status: 'Success',
    message: plan
  });
});

// '/tours-within/:distance/center/:latlng/unit/:unit',

exports.getToursWithin = catchAsync(async (req, res, next) => {
  const { distance, unit, latlng } = req.params;
  const [lat, lng] = latlng.split(',');
  if (!lat || !lng)
    next(new AppError('No Lat or lng provided in the giver format', 404));

  const radius = unit === 'mi' ? distance / 3963.2 : distance / 6378.1;

  const tours = await Tour.findOne({
    startLocation: {
      $geoWithin: {
        $centerSphere: [[lng, lat], radius]
      }
    }
  });

  res.status(200).json({
    status: 'success',
    results: tours.length,
    data: { tours }
  });
});

exports.getDistance = catchAsync(async (req, res, next) => {
  const { unit, latlng } = req.params;

  const multiplier = unit === 'mi' ? 0.000621371 : 0.001;

  const [lat, lng] = latlng.split(',');
  if (!lat || !lng)
    next(new AppError('No Lat or lng provided in the giver format', 404));

  const distances = await Tour.aggregate([
    {
      $geoNear: {
        near: {
          type: 'Point',
          coordinates: [lng * 1, lat * 1]
        },
        distanceField: 'distance',
        distanceMultiplier: multiplier
      }
    },
    {
      $project: {
        distance: 1,
        name: 1
      }
    }
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      distances
    }
  });
});

exports.getAllTours = factory.getAll(Tour);

exports.getTour = factory.getOne(Tour, { path: 'reviews' });

exports.createTour = factory.createOne(Tour);
