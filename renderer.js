
//Scene
let viewport_size = 1;
let viewport_distance = 1;
const BACKGROUND_COLOR = [15,15,15];
const ORIGIN = [0,0,0];

//Spheres
let Sphere = function (position, radius, color, specular) {
    this.position = position;
    this.radius = radius;
    this.color = color;
    this.specular = specular
}

let spheres = [
    new Sphere([1,0,5],1,[255,0,0],200),
    new Sphere([-0.5,0,3],1,[0,0,255],2050),
    new Sphere([0,-5001,0],5000,[255,255,0],null)
]

//Lights
let Light = function (type, intensity) {
    this.type = type;
    this.intensity = intensity;
    this.position = null;
    this.direction = null;
}

let light_point = new Light("point", 0.6);
light_point.position = [1,0,2];

let light_direction = new Light("directional", 0.2);
light_direction.direction = [1,1,0];

let lights = [
    new Light("ambient", 0.2),
    light_point,
    light_direction,
]

//Canvas Setup
let canvas = document.getElementById("canvas");
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
    return [
        x*viewport_size / canvas.width,
        y*viewport_size / canvas.height,
        viewport_distance
    ];
}

//Vector funcions
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
        let ii = 0;
        switch(lights[i].type) {

            case "ambient":
                intensity += lights[i].intensity;
            break;

            case "point":
                rayVector = Subtract(lights[i].position,intersection);
                ii = lights[i].intensity;
            break;

            case "directional":
                rayVector = lights[i].direction;
                ii = lights[i].intensity;
            break;

        }

        if (rayVector == null) {
            continue;
        }
        
        //Diffuse
        let normalRayDot = DotProduct(normal,rayVector);
        if (normalRayDot > 0) {
            intensity += ii * normalRayDot / Length(rayVector);
        }

        //Specular
        if (specular != null) {
            let reflection = Subtract(Multiply(2*normalRayDot,normal),rayVector);
            let reflectionViewDot = DotProduct(reflection,view);

            if (reflectionViewDot > 0) {
                intensity += ii* Math.pow(reflectionViewDot/(Length(reflection)*Length(view)),specular);
            }
        }
    }

    return intensity;
}

//Raytracing functions
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

let TraceRay = (origin, direction, t_min, t_max) => {
    let closest_t = Infinity;
    let closest_sphere = null;

    for (let i = 0; i < spheres.length; i++) {
        let t = IntersectRaySphere(origin,direction,spheres[i])

        if (t[0] > t_min && t[0] < t_max) {
            if (t[0] < closest_t) {
                closest_t = t[0]
                closest_sphere = spheres[i];
            }
        }
        if (t[1] > t_min && t[1] < t_max) {
            if (t[1] < closest_t) {
                closest_t = t[1]
                closest_sphere = spheres[i];
            }
        }
    }

        if (closest_sphere == null) {
            return BACKGROUND_COLOR;
        }

        let intersection = Add(origin,Multiply(closest_t,direction));
        let normal = Subtract(intersection, closest_sphere.position);
        normal = Multiply(1/Length(normal),normal);

        return Multiply(ComputeLighting(intersection, normal,Multiply(-1,direction),closest_sphere.specular),closest_sphere.color);
}

for (let i = -canvas.width/2; i <= canvas.width/2; i++) {
    for (let j = -canvas.width/2; j <= canvas.width/2; j++) {
        let direction = CanvasToViewport(i,j);
        let color = TraceRay(ORIGIN,direction,1,Infinity);
        PutPixel(i,j,color);
    } 
}

UpdateCanvas();