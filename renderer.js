//Constants
const BACKGROUND_COLOR = [15,15,15]; //Colors are represented as arrays with 3 elements -> RGB
const CAMERA_ANGLE = 25;
const CANVAS_WIDTH = 1366;
const CANVAS_HEIGHT = 768;
const ROTATION_AXIS = [1,0,4];

//Sphere Constructor
let Sphere = function (position, radius, color, specular,reflective) {
    this.position = position;
    this.radius = radius;
    this.color = color;
    this.specular = specular;
    this.reflective = reflective;
}

//Spheres
let spheres = [
    new Sphere([2,0,5],1,[200,200,200],200,0.95),
    new Sphere([-0.5,0,3],1,[0,0,255],2050,0.1),
    new Sphere([1,-0.8,3],0.2,[255,0,255],2050,0),
]

//Light Constructor
let Light = function (type, intensity, position, direction) {
    this.type = type;
    this.intensity = intensity;

    //Only point lights have positions
    this.position = position;

    //Only directional lights have direction
    this.direction = direction;
}

//Lights
let lights = [
    new Light("ambient", 0.2),
    new Light("point", 0.6,[1,0,2],null),
    new Light("directional", 0.2,null,[1,1,0]),
]

//Canvas Setup
let canvas = document.getElementById("canvas");

canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;

let canvas_context = canvas.getContext("2d");
let canvas_buffer = canvas_context.getImageData(0, 0, canvas.width, canvas.height);
let canvas_pitch = canvas_buffer.width * 4;

//Rendering functions
let PutPixel = (x, y, color) => {
  x = canvas.width/2 + x;
  y = canvas.height/2 - y - 1;

  if (x < 0 || x >= canvas.width || y < 0 || y >= canvas.height) {
    return;
  }

  let offset = 4*x + canvas_pitch*y;
  canvas_buffer.data[offset++] = color[0];
  canvas_buffer.data[offset++] = color[1];
  canvas_buffer.data[offset++] = color[2];
  canvas_buffer.data[offset++] = 255; // Alpha = 255 (full opacity)
}

let UpdateCanvas = () => {
    canvas_context.putImageData(canvas_buffer, 0, 0);
}

let CanvasToViewport = (x,y) => {
    let ratio = canvas.width/canvas.height;
    let viewport_width = ratio; 
    let viewport_height = 1;
    let viewport_distance = 1;

    return [
        x*viewport_width / canvas.width,
        y*viewport_height / canvas.height,
        viewport_distance
    ];
}

//Vector functions
let Add = (v0,v1) => {
    return [
        v0[0] + v1[0],
        v0[1] + v1[1],
        v0[2] + v1[2],
    ]
}

let Multiply = (k, v) => {
    return [
        k*v[0],
        k*v[1],
        k*v[2],
    ]
}

let Subtract = (v0,v1) => {
    return [
        v0[0] - v1[0],
        v0[1] - v1[1],
        v0[2] - v1[2],
    ]
}

let RotateY = (rotationDegrees, v) => {
    rotationDegrees *= Math.PI/180;
    xx = v[0]*Math.cos(rotationDegrees) - v[2]*Math.sin(rotationDegrees);
    zz = v[0]*Math.sin(rotationDegrees) + v[2]*Math.cos(rotationDegrees);

    return [xx,v[1],zz];
}

let DotProduct = (v0,v1) => {
    return v0[0]*v1[0] + v0[1]*v1[1] + v0[2]*v1[2];
}

let Length = (v) => {
    return Math.sqrt(v[0]*v[0]+v[1]*v[1]+v[2]*v[2]);
}

//Lighting
let ComputeLighting = (intersection, normal,view,specular) => {
    let intensity = 0;
    for (let i = 0; i < lights.length; i++) {
        let rayVector = null;
        let localIntensity = 0;
        let t_max ;
        switch(lights[i].type) {

            case "ambient":
                intensity += lights[i].intensity;
            break;

            case "point":
                rayVector = Subtract(lights[i].position,intersection);
                localIntensity = lights[i].intensity;
                t_max = 1;
            break;

            case "directional":
                rayVector = lights[i].direction;
                localIntensity = lights[i].intensity;
                t_max = Infinity;
            break;

        }

        if (rayVector == null) {
            continue;
        }

        //Do not calculate non-ambient light in case of shadows
        let shadowData = ClosestSphere(intersection,rayVector,0.001,t_max);

        if (shadowData[4]) {
            continue;
        }
        
        //Diffuse
        let normalRayDot = DotProduct(normal,rayVector);
        if (normalRayDot > 0) {
            intensity += localIntensity * normalRayDot / Length(rayVector);
        }

        //Specular
        if (specular != null) {
            let reflection = ReflectRay(rayVector,normal)
            let reflectionViewDot = DotProduct(reflection,view);

            if (reflectionViewDot > 0) {
                intensity += localIntensity * Math.pow(reflectionViewDot/(Length(reflection)*Length(view)),specular);
            }
        }
    }

    return intensity;
}

//Raytracing functions
let ReflectRay = (ray, normal) => {
    let dot = DotProduct(normal,ray);
    return Subtract(Multiply(2*dot,normal),ray);
}

let IntersectRaySphere = (origin, direction, sphere) => {
    let radius = sphere.radius;
    let position_to_origin = Subtract(origin, sphere.position)

    let a = DotProduct(direction,direction);
    let b = 2*DotProduct(position_to_origin, direction);
    let c = DotProduct(position_to_origin,position_to_origin) - radius*radius;
    
    let discriminant = b*b - 4*a*c;

    if (discriminant < 0) {
        return [Infinity, Infinity];
    }

    if (discriminant == 0) {
        return[-b / (2*a),-b / (2*a)]
    }

    t1 = (-b + Math.sqrt(discriminant)) / (2*a);
    t2 = (-b - Math.sqrt(discriminant)) / (2*a);

    return [t1, t2];


}

let IntersectFloor = (origin,direction) => {
    return ((-1-origin[1])/direction[1]);
}

let GenerateFloorPattern = (origin,direction,closest_t) => {
    let floorIntersection = Add(origin,Multiply(closest_t,direction));
    let checker = (Math.abs(floorIntersection[0] % 1) < 0.5)
    if (Math.abs(floorIntersection[2] % 1) < 0.5)
        checker = !checker;

    return Multiply(checker,[255,255,255]);
}

let ClosestSphere = (origin,direction, t_min, t_max) => {
    let closest_t = Infinity;
    let color = null;
    let specular = null;
    let position = null;
    let hit = false;
    let reflective = 0;
    for (let i = 0; i < spheres.length; i++) {
        let t = IntersectRaySphere(origin,direction,spheres[i])
        
        if (t[0] > t_min && t[0] < t_max) {
            if (t[0] < closest_t) {
                closest_t = t[0]
                color = spheres[i].color;
                specular = spheres[i].specular;
                position = spheres[i].position;
                reflective = spheres[i].reflective;
                hit = true
            }
        }
        if (t[1] > t_min && t[1] < t_max) {
            if (t[1] < closest_t) {
                closest_t = t[1]
                color = spheres[i].color;
                specular = spheres[i].specular;
                position = spheres[i].position;
                reflective = spheres[i].reflective;
                hit = true
            }
        }

    }

    return [closest_t,color,specular,position,hit,reflective];
}

let TraceRay = (origin, direction, t_min, t_max, recursion_count) => {
    
    let plane = false;

    //Check intersection with floor
    let closestData = ClosestSphere(origin,direction,t_min,t_max);

    let closest_t = closestData[0]
    let color = closestData[1];
    let specular = closestData[2];
    let position = closestData[3];
    let hit = closestData[4];
    let reflective = closestData[5];

    //Check intersection with floor
    let tf = IntersectFloor(origin,direction);

    if (tf > t_min && tf < t_max) {
        if (tf < closest_t) {
            closest_t = tf;
            color = GenerateFloorPattern(origin,direction,closest_t);
            specular = null;
            reflective = 0.3;
            hit = true;
            plane = true;
        }
    }

    if (!hit) {
        return BACKGROUND_COLOR;
    }

    let intersection = Add(origin,Multiply(closest_t,direction));
    let normal;
    if (plane) {
        normal =[0,1,0];
    }
    else {
        normal = Subtract(intersection, position);

        //Assure that the normal is a unit vector
        normal = Multiply(1/Length(normal),normal);
    }

    let negativeDirection = Multiply(-1,direction)

    let thisColor = Multiply(ComputeLighting(intersection, normal,negativeDirection,specular),color);

    if (recursion_count > 0 && reflective > 0) {
        let reflectionVector = ReflectRay(negativeDirection,normal);
        reflectedColor = TraceRay(intersection,reflectionVector,0.001,t_max,recursion_count-1);

        return Add(Multiply(1-reflective,thisColor),Multiply(reflective,reflectedColor));
    }

    return thisColor;
}

let Render = (rotation) => {
    for (let i = -canvas.width/2; i <= canvas.width/2; i++) {
        for (let j = -canvas.width/2; j <= canvas.width/2; j++) {
            let direction = CanvasToViewport(i,j);

            //Makes the camera rotate a predefined centre while looking at it
            direction = RotateY(rotation,direction);

            //Put the camera at the origin when at angle zero
            let cameraVector = Multiply(-1,ROTATION_AXIS)
            let cameraVectorRotated = RotateY(rotation,cameraVector);

            let cameraPosition = Add(ROTATION_AXIS,cameraVectorRotated);

            let color = TraceRay(cameraPosition,direction,1,Infinity,3);
            PutPixel(i,j,color);
        } 
    }

    UpdateCanvas();
}

function DownloadCanvasAsImage(){
    let downloadLink = document.createElement('a');
    downloadLink.setAttribute('download', 'CanvasAsImage.png');
    let dataURL = canvas.toDataURL('image/png');
    let url = dataURL.replace(/^data:image\/png/,'data:application/octet-stream');
    downloadLink.setAttribute('href', url);
    downloadLink.click();
}

let animateRotation = CAMERA_ANGLE;

let Animate = () => {
    requestAnimationFrame( Animate )
    animateRotation += 0.5
    //Uncomment to capture the image in every frame in case you want to make a prerendered animation
    //DownloadCanvasAsImage();
    Render(animateRotation);
}


Render(CAMERA_ANGLE);
//Uncomment to animate. Warning: extremely slow in high resolutions.
//Animate()

 