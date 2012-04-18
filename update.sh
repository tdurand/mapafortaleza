rm -rf data/
mkdir data/
curl -o data/transporte_coletivo.zip http://www.etufor.ce.gov.br/googleearth/transporte_coletivo.kmz
unzip data/transporte_coletivo.zip -d data/
java -jar ~/Tools/selenium-server-standalone-2.21.0.jar -htmlSuite "*firefox" "http://www.google.fr" ~/Documents/ProjetGitHub/fortalezaonibus/mapafortaleza/update/update-selenium-task-suite ~/Documents/ProjetGitHub/fortalezaonibus/mapafortaleza/update/result.html
