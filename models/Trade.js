/**
 * Trade Model (Optional - for Sequelize/Prisma ORM)
 * 
 * Since we're using raw SQL queries with pg Pool,
 * this file is OPTIONAL and not required for our implementation.
 * 
 * Keeping it here as a reference if you want to switch to an ORM later.
 */

// If using Sequelize:
/*
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Trade = sequelize.define('Trade', {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true
    },
    timestamp: {
      type: DataTypes.BIGINT,
      allowNull: false
    },
    date: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    time: {
      type: DataTypes.TIME,
      allowNull: false
    },
    ticker: {
      type: DataTypes.STRING(10),
      allowNull: false
    },
    strike: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    expiration: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    dte: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    contractType: {
      type: DataTypes.ENUM('CALL', 'PUT'),
      allowNull: false,
      field: 'contract_type'
    },
    contractSymbol: {
      type: DataTypes.STRING(50),
      allowNull: false,
      field: 'contract_symbol'
    },
    price: {
      type: DataTypes.DECIMAL(10, 4),
      allowNull: false
    },
    size: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    premium: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false
    },
    tradeType: {
      type: DataTypes.STRING(20),
      allowNull: false,
      field: 'trade_type'
    },
    priority: {
      type: DataTypes.INTEGER,
      allowNull: false
    }
  }, {
    tableName: 'options_trades',
    timestamps: false
  });

  return Trade;
};
*/

// For now, we're using raw SQL, so this file just exports a comment
module.exports = {
  note: 'Using raw SQL queries with pg Pool. ORM not needed.'
};