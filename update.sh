rm -rf data/
mkdir data/
curl -o data/transporte_coletivo.zip http://www.etufor.ce.gov.br/googleearth/transporte_coletivo.kmz
unzip data/transporte_coletivo.zip -d data/
