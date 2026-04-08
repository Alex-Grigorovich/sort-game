let versions = [
    {
        name: '15c',
        actions: 0,
        clicks: 15,
        missClick: true,
        prod: false,
        showPackshot: true
    },
    {
        name: '10c',
        actions: 0,
        clicks: 10,
        missClick: true,
        prod: false,
        showPackshot: true
    },
    {
        name: '7c',
        actions: 0,
        clicks: 7,
        missClick: true,
        prod: false,
        showPackshot: true
    },
    {
        name: 'full',
        actions: 0,
        clicks: 12,
        missClick: false,
        prod: true,
        showPackshot: true
    }
];
versions.language = 'en';
versions.selectedVersion = '15c';

versions.variables = {
    prod: true,
    clicks: 0,
    actions: 0,
    showPackshot: true,
    missClick: false
};

module.exports = versions;
